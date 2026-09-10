// FRPB — license verification core business logic.
// Pure-ish function: takes a Prisma client + inputs, returns HTTP status + body.
// Mirrors plans/frpb-architecture-blueprint.md §5.1 (incl. UNBOUND re-activation).

import type { PrismaClient, LicenseDevice } from "@prisma/client";
import { LicenseStatus } from "@prisma/client";
import { sha256 } from "@/lib/crypto/sha256";
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

  const license = await prisma.license.findUnique({
    where: { keySha256 },
    include: { plan: true, devices: true },
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
    return {
      httpStatusCode: 403,
      body: { success: false, status: "EXPIRED", message: "License expired" },
    };
  }

  // 5. Device binding — UNBOUND devices re-activate, limit counts CONNECTED only
  const activeDevices = license.devices.filter((d: LicenseDevice) => d.status !== "UNBOUND");
  let device = activeDevices.find((d) => d.hardwareId === hardwareId);

  if (device) {
    // Known machine (or previously unbound machine re-connecting)
    await prisma.licenseDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), deviceName, status: "CONNECTED" },
    });
  } else {
    // New machine → enforce limit against ACTIVE devices only
    if (activeDevices.length >= license.deviceLimit) {
      return {
        httpStatusCode: 200,
        body: {
          success: false,
          status: "DEVICE_LIMIT_EXCEEDED",
          message: `Device limit of ${license.deviceLimit} reached for this license`,
        },
      };
    }
    device = await prisma.licenseDevice.create({
      data: { licenseId: license.id, hardwareId, deviceName, status: "CONNECTED" },
    });
  }

  // 6. Online-only enforcement: stamp every successful verification
  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      lastVerifiedAt: new Date(),
      activatedAt: license.activatedAt ?? new Date(),
      status: LicenseStatus.ACTIVE,
    },
    include: { plan: true },
  });

  const devicesUsed = await prisma.licenseDevice.count({
    where: { licenseId: updated.id, status: { not: "UNBOUND" } },
  });

  return {
    httpStatusCode: 200,
    body: {
      success: true,
      status: "ACTIVE",
      license: {
        key: updated.key,
        plan: updated.plan.slug,
        planName: updated.plan.name,
        expiresAt: updated.expiresAt,
        deviceLimit: updated.deviceLimit,
        devicesUsed,
        activatedAt: updated.activatedAt,
      },
      message: "License activated",
    },
  };
}
