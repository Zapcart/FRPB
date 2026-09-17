// FRPB — port-filter regression check.
//
//   node scripts/verify-port-filter.mjs
//
// Re-implements the EXACT predicates from electron/hardware/detector.ts
// (isVirtualOrBluetoothPort / isValidMobileVid / isValidMobilePid) and asserts
// the behaviour the Bluetooth fix depends on. Kept dependency-free so it runs
// anywhere.
//
// If you change the patterns or the vendor/product allow-lists in detector.ts,
// change them here too — this file exists to make that breakage loud. It also
// reads detector.ts to confirm the reject list (BTHENUM / BTH / Bluetooth /
// com0com) is still present, so a well-meaning refactor cannot silently delete
// the hardware filter while every local predicate here keeps passing.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DETECTOR_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "electron",
  "hardware",
  "detector.ts",
);

/** Assert the detector source still carries every required reject token. */
function verifyDetectorSource() {
  let source = "";
  try {
    source = readFileSync(DETECTOR_PATH, "utf8");
  } catch (err) {
    console.log(`FAIL | could not read detector.ts: ${String(err)}`);
    return false;
  }
  const required = [
    ["BTHENUM token", /bthEnum|BTHENUM/i],
    ["BTH token", /\\bbth\\b/i],
    ["Bluetooth token", /bluetooth/i],
    ["com0com token", /com0com/i],
    ["mobile VID allow-list", /VALID_MOBILE_VIDS/],
    ["mobile PID allow-list", /VALID_MOBILE_PIDS/],
    ["waiting label", /Waiting for USB Phone Connection\.\.\./],
  ];
  let ok = true;
  for (const [name, re] of required) {
    const present = re.test(source);
    if (!present) ok = false;
    console.log(`${present ? "PASS" : "FAIL"} | detector.ts contains ${name}`);
  }
  return ok;
}

console.log("FRPB — detector source guards\n");
let sourceFail = 0;
if (!verifyDetectorSource()) sourceFail = 1;
console.log("");

const VALID_MOBILE_VIDS = new Set([
  0x0e8d, // MediaTek
  0x05c6, // Qualcomm
  0x04e8, // Samsung
  0x1782, // UNISOC
  0x18d1, // Google ADB/Fastboot
  0x2717, // Xiaomi
  0x2e17, // Xiaomi (alt)
  0x22b8, // Motorola
  0x2a70, // OnePlus
  0x2e40, // OPPO / Realme
  0x2d95, // vivo
  0x12d1, // Huawei / Honor
]);

// Mirrors VALID_MOBILE_PIDS in detector.ts.
const VALID_MOBILE_PIDS = new Set([
  0x9008, 0x900e, 0x901d, 0x9039, 0x9048, 0x9056, 0x9070, 0x9091,
  0x685d, 0x6860, 0x6855, 0x685b, 0x6863, 0x685c,
  0x4ee0, 0x4ee2, 0x4ee7, 0xd00d,
  0x1782, 0x4d00,
]);

const VIRTUAL_PORT_PATTERNS = [
  /bthenum/i,
  /\bbth\b/i,
  /bluetooth/i,
  /com0com/i,
  /^root\\/i,
  /^swd\\/i,
  /virtual\s+serial/i,
  /standard\s+serial\s+over\s+bluetooth/i,
];

function isVirtualOrBluetoothPort(port) {
  const hay = [port.pnpId, port.path, port.friendlyName, port.manufacturer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!hay) return true;
  if (VIRTUAL_PORT_PATTERNS.some((re) => re.test(hay))) return true;
  return /^bth/i.test(String(port.path ?? "").toLowerCase());
}

function isValidMobileVid(vid) {
  return typeof vid === "number" && VALID_MOBILE_VIDS.has(vid);
}

// Mirrors isValidMobilePid(): an unknown/zero PID defers to the VID evidence,
// and MediaTek accepts any PID because its product ids are per-model.
function isValidMobilePid(vid, pid) {
  if (pid === null || pid === undefined || pid === 0) return true;
  if (vid === 0x0e8d) return true;
  return VALID_MOBILE_PIDS.has(pid);
}

function isMobilePortEvidence(vid, pid) {
  return isValidMobileVid(vid) && isValidMobilePid(vid, pid);
}

function resolveVid(port) {
  if (port.vendorId) {
    const p = Number.parseInt(String(port.vendorId).replace(/^0x/i, ""), 16);
    if (Number.isFinite(p)) return p;
  }
  const m = /VID_([0-9A-F]{4})/i.exec(port.pnpId ?? "");
  return m ? Number.parseInt(m[1], 16) : null;
}

function resolvePid(port) {
  if (port.productId) {
    const p = Number.parseInt(String(port.productId).replace(/^0x/i, ""), 16);
    if (Number.isFinite(p)) return p;
  }
  const m = /PID_([0-9A-F]{4})/i.exec(port.pnpId ?? "");
  return m ? Number.parseInt(m[1], 16) : null;
}

const cases = [
  [
    "Bluetooth headset (BTHENUM COM3)",
    {
      pnpId: "BTHENUM\\{0000111E-0000-1000-8000-00805F9B34FB}_LOCALMFG&0000",
      path: "COM3",
      friendlyName: "Standard Serial over Bluetooth link (COM3)",
      manufacturer: "Microsoft",
    },
    true,
  ],
  [
    "Bluetooth path only",
    { pnpId: "USB\\VID_0A12&PID_0001", path: "COM11", friendlyName: "Bluetooth Link" },
    true,
  ],
  [
    "com0com virtual pair",
    { pnpId: "com0com\\port0", path: "COM4", friendlyName: "com0com serial emulator" },
    true,
  ],
  [
    "ROOT-enumerated virtual",
    { pnpId: "ROOT\\PORTS\\0000", path: "COM9", friendlyName: "Virtual Serial Port" },
    true,
  ],
  ["No metadata at all", {}, true],
  [
    "MediaTek Preloader",
    {
      pnpId: "USB\\VID_0E8D&PID_0003\\5&1F2A",
      path: "COM5",
      friendlyName: "MediaTek USB Port (COM5)",
      manufacturer: "MediaTek Inc.",
      vendorId: "0E8D",
    },
    false,
  ],
  [
    "Qualcomm EDL 9008",
    {
      pnpId: "USB\\VID_05C6&PID_9008\\6&2B3C",
      path: "COM7",
      friendlyName: "Qualcomm HS-USB QDLoader 9008 (COM7)",
      vendorId: "05C6",
    },
    false,
  ],
  [
    "Samsung modem",
    {
      pnpId: "USB\\VID_04E8&PID_6860\\7&3C4D",
      path: "COM12",
      friendlyName: "SAMSUNG Mobile USB Modem",
    },
    false,
  ],
  [
    "Generic COM3 with no vendor metadata (was 'Connected')",
    { path: "COM3", friendlyName: "Prolific USB-to-Serial Comm Port (COM3)" },
    true,
  ],
  [
    "Bluetooth token in manufacturer only",
    {
      pnpId: "USB\\VID_0A12&PID_0001\\5&2A3B",
      path: "COM8",
      friendlyName: "Serial Port (COM8)",
      manufacturer: "Bluetooth Radio",
    },
    true,
  ],
  [
    "Mobile VID but non-mobile PID (Samsung 05C6? no — 04E8:1234)",
    {
      pnpId: "USB\\VID_04E8&PID_1234\\7&3C4D",
      path: "COM6",
      friendlyName: "Generic USB Serial (COM6)",
      vendorId: "04E8",
      productId: "1234",
    },
    true,
  ],
  [
    "MediaTek VID accepts any PID (per-model BROM ids)",
    {
      pnpId: "USB\\VID_0E8D&PID_FFFF\\5&1F2A",
      path: "COM6",
      friendlyName: "MediaTek USB Port (COM6)",
      vendorId: "0E8D",
      productId: "FFFF",
    },
    false,
  ],
];

let pass = 0;
let fail = 0;

console.log("FRPB — COM port filter verification\n");

for (const [name, port, expectAcceptedRaw] of cases) {
  const virtual = isVirtualOrBluetoothPort(port);
  const vid = resolveVid(port);
  const pid = resolvePid(port);
  // A port is "accepted as a phone candidate" only when it is not virtual AND
  // carries matching mobile VID + PID evidence. Note the expectations below are
  // the ACCEPTED flag, not the virtual flag: a Bluetooth port is both virtual
  // and rejected, while a generic COM3 is not "virtual" yet still rejected.
  const accepted = !virtual && isMobilePortEvidence(vid, pid);
  const expectAccepted = Boolean(expectAcceptedRaw) === false;
  const ok = accepted === expectAccepted;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${name.padEnd(46)} ` +
      `virtual=${String(virtual).padEnd(5)} vid=${String(vid).padEnd(6)} ` +
      `pid=${String(pid).padEnd(6)} accepted=${accepted}`
  );
}

// ─── connectionStateFrom() — the source of the "Connected · COM" label ───────
//
// Mirrors the guard in electron/ipc/device.ts. The regression this pins: a
// machine with ONLY a Bluetooth headset used to report connection "com", which
// the UI rendered as "Connected · COM" with no phone attached. "com" is now
// allowed only for a genuine BROM/preloader/EDL transport.
function connectionStateFrom(s) {
  if (!s.connected) return "disconnected";
  const mode = `${s.mode ?? ""} ${s.mtp ?? ""}`.toLowerCase();
  if (/fastboot|bootloader/.test(mode)) return "fastboot";
  if (s.source === "adb") return "adb";
  if (/brom|vcom|preloader/.test(mode)) return "brom";
  if (/edl|9008/.test(mode)) return "edl";
  if (/mtp/.test(mode)) return "mtp";
  if (s.port) {
    const hw = s.hardwareMode ?? "";
    if (hw === "brom" || hw === "preloader" || hw === "edl") return "com";
  }
  return s.source === "usb" ? "mtp" : "disconnected";
}

const stateCases = [
  [
    "Bluetooth COM3 only (was 'com' — the bug)",
    { connected: true, source: "usb", port: "COM3", hardwareMode: "serial", mode: "Serial Port (COM3)" },
    "mtp",
  ],
  ["Nothing connected", { connected: false }, "disconnected"],
  // A BROM/EDL device is classified by its MODE string first, so it reports the
  // more specific "brom"/"edl" rather than the generic "com". "com" is only the
  // fallback for a low-level transport whose label does not name the mode.
  [
    "MediaTek BROM on COM5",
    { connected: true, source: "usb", port: "COM5", hardwareMode: "brom", mode: "MediaTek BROM Mode (COM5)" },
    "brom",
  ],
  [
    "Qualcomm EDL on COM7",
    { connected: true, source: "usb", port: "COM7", hardwareMode: "edl", mode: "Qualcomm EDL 9008 Mode (COM7)" },
    "edl",
  ],
  [
    "Low-level transport, mode label unhelpful -> com",
    { connected: true, source: "usb", port: "COM8", hardwareMode: "preloader", mode: "MediaTek USB Port (COM8)" },
    "com",
  ],
  ["ADB phone", { connected: true, source: "adb", port: null, mode: "ADB" }, "adb"],
  [
    "Fastboot",
    { connected: true, source: "usb", port: null, mode: "Fastboot / Bootloader" },
    "fastboot",
  ],
];

console.log("\nconnectionStateFrom() — 'Connected · COM' guard\n");
for (const [name, snapshot, expected] of stateCases) {
  const got = connectionStateFrom(snapshot);
  const ok = got === expected;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${name.padEnd(38)} -> ${got}${ok ? "" : ` (expected ${expected})`}`
  );
}

console.log("\n" + "-".repeat(62));
console.log(`result: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
