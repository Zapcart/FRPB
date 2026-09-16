// FRPB — port-filter regression check.
//
//   node scripts/verify-port-filter.mjs
//
// Re-implements the EXACT predicates from electron/hardware/detector.ts
// (isVirtualOrBluetoothPort / isValidMobileVid) and asserts the behaviour the
// Bluetooth fix depends on. Kept dependency-free so it runs anywhere.
//
// If you change the patterns or the vendor allow-list in detector.ts, change
// them here too — this file exists to make that breakage loud.

const VALID_MOBILE_VIDS = new Set([
  0x0e8d, // MediaTek
  0x05c6, // Qualcomm
  0x04e8, // Samsung
  0x1782, // UNISOC
  0x18d1, // Google ADB/Fastboot
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
    .join(" ");
  if (!hay) return true;
  if (VIRTUAL_PORT_PATTERNS.some((re) => re.test(hay))) return true;
  return /^BTH/i.test(port.path ?? "");
}

function isValidMobileVid(vid) {
  return typeof vid === "number" && VALID_MOBILE_VIDS.has(vid);
}

function resolveVid(port) {
  if (port.vendorId) {
    const p = Number.parseInt(String(port.vendorId).replace(/^0x/i, ""), 16);
    if (Number.isFinite(p)) return p;
  }
  const m = /VID_([0-9A-F]{4})/i.exec(port.pnpId ?? "");
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
];

let pass = 0;
let fail = 0;

console.log("FRPB — COM port filter verification\n");

for (const [name, port, expectVirtual] of cases) {
  const virtual = isVirtualOrBluetoothPort(port);
  const vid = resolveVid(port);
  // A port is "accepted as a phone candidate" only when it is not virtual AND
  // carries a valid mobile vendor id.
  const accepted = !virtual && isValidMobileVid(vid);
  const expectAccepted = !expectVirtual;
  const ok = virtual === expectVirtual && accepted === expectAccepted;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${name.padEnd(33)} ` +
      `virtual=${String(virtual).padEnd(5)} vid=${String(vid).padEnd(6)} accepted=${accepted}`
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
