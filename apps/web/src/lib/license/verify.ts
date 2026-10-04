// FRPB — license verification core business logic.
// Pure-ish function: takes a Prisma client + inputs, returns HTTP status + body.
// Mirrors plans/frpb-architecture-blueprint.md §5.1 (incl. UNBOUND re-activation).
//
// Performance (plans/performance-optimization.md §Task 2):
//   • A repeat verify within the TTL short-circuits with ZERO DB round-trips.
//   • The per-request `lastVerifiedAt`/device `lastSeenAt` writes are throttled
//     so steady-state polling becomes effectively read-only.
//   • `devicesUsed` is derived from the already-loaded device rows instead of a
//     third `count()` query.

import type { PrismaClient, LicenseDevice } from "@prisma/client";
import { DeviceStatus, LicenseStatus } from "@prisma/client";
import { sha256 } from "@/lib/crypto/sha256";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";
import type { VerifyStatus } from "@frpb/shared";

export interface VerifyLicenseInput {
  prisma: PrismaClient;
  key: string;
  hardwareId: string;
  deviceName: string;
}

export interface VerifyLicenseResult {
  httpStatusCode: number;
  body: {
    success: boolean;
    status: VerifyStatus;
    message: string;
    license?: {
      key: string;
      plan: string;
      planName: string;
      expiresAt: Date | null;
      deviceLimit: number;
      devicesUsed: number;
      activatedAt: Date | null;
    };
  };
}

/** How long a successful verification is served from cache (seconds). */
const CACHE_TTL_SECONDS = 45;
/** Minimum gap between persisted activity writes for one license/device. */
const WRITE_THROTTLE_MS = 60_000;

/**
 * The exact column subset loaded for device binding. Kept as a `Pick` of the
 * Prisma model so the projection stays type-safe without pulling the full row
 * (createdAt / unboundAt / unbindCount are never read here).
 */
type SelectedDevice = Pick<
  LicenseDevice,
  "id" | "hardwareId" | "deviceName" | "status" | "lastSeenAt"
>;

/** Serialised (JSON-safe) shape stored in the cache. Dates are ISO strings. */
interface CachedVerify {
  plan: string;
  planName: string;
  expiresAt: string | null;
  deviceLimit: number;
  devicesUsed: number;
  activatedAt: string | null;
}

/** Cache key for a (license, hardware) pair — the pair a success is scoped to. */
export function licenseVerifyCacheKey(keySha256: string, hardwareId: string): string {
  return `lic:v1:${keySha256}:${hardwareId}`;
}

export async function verifyLicenseCore({
  prisma,
  key,
  hardwareId,
  deviceName,
}: VerifyLicenseInput): Promise<VerifyLicenseResult> {
  // 1. Normalize + hash key. Only the SHA-256 of the key is stored; the raw key
  //    is encrypted at rest and never logged.
  const normalizedKey = key.trim().toUpperCase();
  const keySha256 = sha256(normalizedKey);
  const cacheKey = licenseVerifyCacheKey(keySha256, hardwareId);

  // 1.1 Cache fast-path — a repeated verify within the TTL issues no DB reads.
  //     The raw key is NOT stored; it is rebuilt from the caller's input.
  const cached = await cacheGet<CachedVerify>(cacheKey);
  if (cached) {
    return {
      httpStatusCode: 200,
      body: {
        success: true,
        status: "ACTIVE",
        message: "License activated",
        license: {
          key: normalizedKey,
          plan: cached.plan,
          planName: cached.planName,
          expiresAt: cached.expiresAt ? new Date(cached.expiresAt) : null,
          deviceLimit: cached.deviceLimit,
          devicesUsed: cached.devicesUsed,
          activatedAt: cached.activatedAt ? new Date(cached.activatedAt) : null,
        },
      },
    };
  }

  // 2. Load the license with a NARROW projection — only the scalar fields the
  //    response needs plus the plan slug/name. We deliberately do NOT
  //    `include: { devices: true }`, which hydrates an unbounded device history
  //    (every machine ever bound) on each cache-miss verify.
  const license = await prisma.license.findUnique({
    where: { keySha256 },
    select: {
      id: true,
      status: true,
      deviceLimit: true,
      expiresAt: true,
      revokedReason: true,
      activatedAt: true,
      lastVerifiedAt: true,
      plan: { select: { slug: true, name: true } },
    },
  });

  // 2. Key not found
  if (!license) {
    return {
      httpStatusCode: 401,
      body: { success: false, status: "INVALID_KEY", message: "Invalid license key" },
    };
  }

  // 3. Status gate
  if (license.status === LicenseStatus.REVOKED) {
    // Drop any stale success so the revocation converges immediately.
    await cacheDel(cacheKey);
    return {
      httpStatusCode: 403,
      body: {
        success: false,
        status: "REVOKED",
        message: license.revokedReason ?? "License revoked",
      },
    };
  }

  // 4. Expiry gate (lifetime plans have expiresAt = null)
  if (license.expiresAt && license.expiresAt < new Date()) {
    await prisma.license.update({
      where: { id: license.id },
      data: { status: LicenseStatus.EXPIRED },
    });
    await cacheDel(cacheKey);
    return {
      httpStatusCode: 403,
      body: { success: false, status: "EXPIRED", message: "License expired" },
    };
  }

  // 5. Device binding — UNBOUND devices re-activate. The bound list is capped at
  //    `deviceLimit + 1` rows (indexed by licenseId) so an unbounded device
  //    history is never hydrated. The +1 lets us distinguish "at capacity" from
  //    "over capacity" without the extra `count()` query the old code issued.
  const activeDevices: SelectedDevice[] = await prisma.licenseDevice.findMany({
    where: { licenseId: license.id, status: { not: DeviceStatus.UNBOUND } },
    take: Math.max(license.deviceLimit, 0) + 1,
    select: {
      id: true,
      hardwareId: true,
      deviceName: true,
      status: true,
      lastSeenAt: true,
    },
  });
  const device = activeDevices.find((d) => d.hardwareId === hardwareId);

  let devicesUsed: number;
  if (device) {
    // Known machine (or previously unbound machine re-connecting). Only refresh
    // the activity stamp when it is stale — otherwise a polling client would
    // force a device write on every single verify.
    devicesUsed = activeDevices.length;
    const stale = Date.now() - device.lastSeenAt.getTime() > WRITE_THROTTLE_MS;
    if (stale || device.deviceName !== deviceName || device.status !== "CONNECTED") {
      await prisma.licenseDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date(), deviceName, status: "CONNECTED" },
      });
    }
  } else {
    // New machine → enforce limit against ACTIVE devices only
    if (activeDevices.length >= license.deviceLimit) {
      await cacheDel(cacheKey);
      return {
        httpStatusCode: 200,
        body: {
          success: false,
          status: "DEVICE_LIMIT_EXCEEDED",
          message: `Device limit of ${license.deviceLimit} reached for this license`,
        },
      };
    }
    await prisma.licenseDevice.create({
      data: { licenseId: license.id, hardwareId, deviceName, status: "CONNECTED" },
    });
    // The freshly created device is not in `activeDevices` (loaded before the
    // insert), so it is the +1. Mirrors the removed `count()` exactly.
    devicesUsed = activeDevices.length + 1;
  }

  // 6. Online-only enforcement: stamp every successful verification, but only
  //    actually WRITE when the stamp is stale or the license still needs its
  //    status/activation persisted. A steady poller with an already-ACTIVE
  //    license therefore issues no write at all.
  const now = new Date();
  const activatedAt = license.activatedAt ?? now;
  const stampStale =
    !license.lastVerifiedAt ||
    now.getTime() - license.lastVerifiedAt.getTime() > WRITE_THROTTLE_MS;
  const needsStatusWrite =
    license.status !== LicenseStatus.ACTIVE || license.activatedAt === null;

  if (stampStale || needsStatusWrite) {
    await prisma.license.update({
      where: { id: license.id },
      data: {
        // Advance the stamp only when stale; always persist activation/status.
        ...(stampStale ? { lastVerifiedAt: now } : {}),
        activatedAt,
        status: LicenseStatus.ACTIVE,
      },
    });
  }

  // 7. Populate the cache so the next verify within the TTL skips the DB.
  await cacheSet<CachedVerify>(
    cacheKey,
    {
      plan: license.plan.slug,
      planName: license.plan.name,
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
      deviceLimit: license.deviceLimit,
      devicesUsed,
      activatedAt: activatedAt.toISOString(),
    },
    CACHE_TTL_SECONDS
  );

  return {
    httpStatusCode: 200,
    body: {
      success: true,
      status: "ACTIVE",
      license: {
        key: normalizedKey,
        plan: license.plan.slug,
        planName: license.plan.name,
        expiresAt: license.expiresAt,
        deviceLimit: license.deviceLimit,
        devicesUsed,
        activatedAt,
      },
      message: "License activated",
    },
  };
}
