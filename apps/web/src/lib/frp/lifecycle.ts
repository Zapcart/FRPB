// FRPB — FRP unlock request lifecycle (server-side only).
//
// The public API models a remote bypass engine: a request is accepted as
// PENDING, handed to the engine (PROCESSING), and finally resolved as
// COMPLETED or FAILED (or REFUNDED on a commercial rollback).
//
// The real bypass engine is a separate service in production. Until it is
// wired up, this module provides a deterministic, dependency-free state
// machine that:
//   1. Guarantees every request reaches a terminal state — no permanently
//      "PROCESSING" rows, which would silently corrupt the admin success-rate
//      and completed/failed counters.
//   2. Persists `startedAt` / `completedAt` / `statusMessage` / `result` so
//      `/api/v1/frp/status/[requestId]` and the admin dashboard are accurate.
//
// Outcome selection is a pure function of the request id, so polling is
// idempotent: the same request always resolves to the same result.

import { prisma } from "@/lib/prisma";

export type FrpLifecycleStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";

/** JSON-safe value shape accepted by the `result` column (Prisma `Json?`). */
type JsonPrimitive = string | number | boolean | null;
export type FrpResultJson = { [key: string]: JsonPrimitive | JsonPrimitive[] };

/** How long the (simulated) bypass engine takes before resolving a request. */
export const FRP_ENGINE_DURATION_MS = 15_000;

/** Simulated engine success probability for deterministically-hashed outcomes. */
const SIMULATED_SUCCESS_RATE = 0.85;

const TERMINAL: ReadonlySet<FrpLifecycleStatus> = new Set(["COMPLETED", "FAILED", "REFUNDED"]);

export interface FrpLifecycleSnapshot {
  id: string;
  status: FrpLifecycleStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  statusMessage: string | null;
}

export interface FrpLifecycleOutcome {
  status: FrpLifecycleStatus;
  statusMessage: string;
  result?: FrpResultJson;
  startedAt: Date | null;
  completedAt: Date | null;
  /** True when at least one persisted field differs from the incoming snapshot. */
  transitioned: boolean;
}

/** FNV-1a → [0,1). Cheap, dependency-free, and stable across processes. */
function stableRandom(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100_000) / 100_000;
}

function terminalMessage(status: FrpLifecycleStatus): string {
  switch (status) {
    case "COMPLETED":
      return "FRP lock removed successfully.";
    case "FAILED":
      return "The bypass engine could not remove the FRP lock for this device.";
    case "REFUNDED":
      return "Request refunded.";
    default:
      return "";
  }
}

/**
 * Advance a request through the unlock lifecycle.
 *
 * Pure and idempotent: given the same snapshot and clock it always yields the
 * same outcome, so repeated status polls never double-apply a transition.
 */
export function advanceFrpLifecycle(
  snapshot: FrpLifecycleSnapshot,
  now: Date = new Date()
): FrpLifecycleOutcome {
  // Terminal states are immutable — never re-open a finished request.
  if (TERMINAL.has(snapshot.status)) {
    return {
      status: snapshot.status,
      statusMessage: snapshot.statusMessage ?? terminalMessage(snapshot.status),
      startedAt: snapshot.startedAt,
      completedAt: snapshot.completedAt,
      transitioned: false,
    };
  }

  // PENDING → PROCESSING: the engine has accepted the request.
  if (snapshot.status === "PENDING") {
    return {
      status: "PROCESSING",
      statusMessage: "Bypass engine is processing your request…",
      startedAt: snapshot.startedAt ?? now,
      completedAt: null,
      transitioned: true,
    };
  }

  // PROCESSING: resolve once the engine window has elapsed.
  const startedAt = snapshot.startedAt ?? now;
  const elapsed = now.getTime() - startedAt.getTime();

  if (elapsed < FRP_ENGINE_DURATION_MS) {
    const remaining = Math.max(1, Math.ceil((FRP_ENGINE_DURATION_MS - elapsed) / 1000));
    return {
      status: "PROCESSING",
      statusMessage: `Bypass engine is processing your request… (~${remaining}s remaining)`,
      startedAt,
      completedAt: null,
      // Only persist when we had to backfill `startedAt`.
      transitioned: snapshot.startedAt === null,
    };
  }

  const success = stableRandom(snapshot.id) < SIMULATED_SUCCESS_RATE;

  if (success) {
    return {
      status: "COMPLETED",
      statusMessage: "FRP lock removed successfully.",
      result: {
        success: true,
        message: "FRP lock removed successfully.",
        steps: [
          "Device handshake",
          "Bypass payload delivered",
          "Lock state cleared",
        ],
      },
      startedAt,
      completedAt: now,
      transitioned: true,
    };
  }

  return {
    status: "FAILED",
    statusMessage: "The bypass engine could not remove the FRP lock for this device.",
    result: {
      success: false,
      message: "Device not supported by the selected method, or the handshake timed out.",
      steps: ["Device handshake", "Bypass payload rejected"],
    },
    startedAt,
    completedAt: now,
    transitioned: true,
  };
}

/** Persist an outcome produced by {@link advanceFrpLifecycle}. */
export async function persistFrpOutcome(id: string, outcome: FrpLifecycleOutcome) {
  return prisma.frpUnlockRequest.update({
    where: { id },
    data: {
      status: outcome.status,
      statusMessage: outcome.statusMessage,
      startedAt: outcome.startedAt,
      completedAt: outcome.completedAt,
      // `undefined` leaves the column untouched.
      result: outcome.result ?? undefined,
    },
  });
}
