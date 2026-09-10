// FRPB — Stable hardware fingerprint.
// Combines platform machine identifiers and hashes with HMAC-SHA256 so the
// value stays stable across app reinstalls and cannot be trivially spoofed.

import { createHmac, createHash } from "node:crypto";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "./logger";

const execFileAsync = promisify(execFile);

// DO NOT ship a real secret in the client. This pepper is a tamper-deterrent
// only — the server side remains the source of truth for license validity.
const FALLBACK_PEPPER = "frpb-desktop-fingerprint-v1";

const HMAC_SECRET = process.env.FRPB_HWID_PEPPER ?? FALLBACK_PEPPER;

function hmac(value: string): string {
  return createHmac("sha256", HMAC_SECRET).update(value).digest("hex");
}

async function getWindowsMachineGuid(): Promise<string | null> {
  try {
    // HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid — stable across reinstalls
    const { stdout } = await execFileAsync(
      "reg",
      [
        "query",
        "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid",
      ],
      { timeout: 3000, windowsHide: true }
    );
    const match = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(stdout);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function getMacHardwareUuid(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("ioreg", [
      "-rd1",
      "-c",
      "IOPlatformExpertDevice",
    ]);
    const match = /"IOPlatformUUID"\s*=\s*"([0-9a-fA-F-]+)"/.exec(stdout);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function getLinuxMachineId(): string | null {
  try {
    return require("node:fs")
      .readFileSync("/etc/machine-id", "utf8")
      .trim();
  } catch {
    return null;
  }
}

export async function getHardwareId(): Promise<string> {
  let seed = "";

  switch (process.platform) {
    case "win32": {
      const guid = await getWindowsMachineGuid();
      seed = `win32:${guid ?? os.hostname()}`;
      break;
    }
    case "darwin": {
      const uuid = await getMacHardwareUuid();
      seed = `darwin:${uuid ?? os.hostname()}`;
      break;
    }
    case "linux": {
      seed = `linux:${getLinuxMachineId() ?? os.hostname()}`;
      break;
    }
    default: {
      seed = `${process.platform}:${os.hostname()}`;
    }
  }

  // Add the primary MAC address so a cloned disk doesn't duplicate an identity.
  const mac = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (i): i is os.NetworkInterfaceInfo =>
        !!i && !i.internal && i.mac !== "00:00:00:00:00:00"
    )
    .map((i) => i.mac)
    .sort()
    .join(",");

  const fingerprint = createHash("sha256")
    .update(`${seed}|${mac}|${os.cpus().length}`)
    .digest("hex");

  const hwid = hmac(fingerprint);
  log.debug(`hardwareId resolved (${hwid.slice(0, 12)}…)`);
  return hwid;
}
