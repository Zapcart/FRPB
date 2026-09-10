// FRPB — Online FRP unlock API routes.
// Mirrors the Dr.Fone-style "submit IMEI + device info → remote unlock" flow.
// The actual bypass engine runs server-side; these routes accept requests,
// queue them, and return status. In a real deployment the bypass engine would
// be a separate service; here we model the contract and the request lifecycle.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto/sha256";
import { z } from "zod";

// ─── Request validation ──────────────────────────────────────────────────────
const FrpRequestSchema = z.object({
  brand: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  androidVersion: z.string().max(32).optional(),
  imei: z.string().min(1).max(15).optional(),
  method: z.enum(["setup-wizard", "download-mode", "edl-mode", "mtk-brom", "oem-service"]),
  // If the user is authenticated, bind the request to their account for status tracking.
  token: z.string().max(64).optional(), // license key or session token
});

export type FrpRequest = z.infer<typeof FrpRequestSchema>;

// ─── POST /api/v1/frp/request ────────────────────────────────────────────────
// Create a new FRP unlock request. Returns a request ID the client can poll.
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // ── Rate limit per IP: 3 requests per minute ──
    const rl = await rateLimit(`frp-request:${ip}`, 3, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, status: "RATE_LIMITED", message: "Too many requests. Please wait a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await req.json();
    const parsed = FrpRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, status: "INVALID_REQUEST", message: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── License-based authentication ──
    // If token present, verify it's a valid active license.
    let userId: string | null = null;
    if (data.token) {
      const tokenNorm = data.token.trim().toUpperCase().replace(/\s+/g, "");
      const keySha = await sha256(tokenNorm);
      const license = await prisma.license.findUnique({
        where: { keySha256: keySha },
        include: { plan: true },
      });
      if (!license || license.status !== "ACTIVE" || (license.expiresAt && license.expiresAt < new Date())) {
        return NextResponse.json(
          { success: false, status: "UNAUTHORIZED", message: "Invalid or inactive license." },
          { status: 401 }
        );
      }
      userId = license.userId;
    }

    const request = await prisma.frpUnlockRequest.create({
      data: {
        brand: data.brand,
        model: data.model,
        androidVersion: data.androidVersion ?? null,
        imei: data.imei ?? null,
        imeiHash: data.imei ? await sha256(data.imei) : null, // hash for privacy
        method: data.method,
        ipAddress: ip,
        userId,
        status: "PENDING",
        requestedAt: new Date(),
      },
    });

    // Trigger bypass engine asynchronously (simulated here)
    await prisma.frpUnlockRequest.update({
      where: { id: request.id },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    // In production: queue a background job here (e.g. queue.ts / Redis job)

    return NextResponse.json(
      {
        success: true,
        requestId: request.id,
        status: "processing",
        message: "Your FRP unlock request has been received. Poll /api/v1/frp/status/{requestId} for updates.",
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("[frp/request] error:", err);
    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: "Request could not be processed." },
      { status: 500 }
    );
  }
}

// ─── GET /api/v1/frp/status/[requestId] ──────────────────────────────────────
// Poll the status of an FRP unlock request.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const request = await prisma.frpUnlockRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, status: "NOT_FOUND", message: "Request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId: request.id,
      status: request.status,
      message: request.statusMessage ?? "",
      completedAt: request.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[frp/status] error:", err);
    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: "Status check failed." },
      { status: 500 }
    );
  }
}
