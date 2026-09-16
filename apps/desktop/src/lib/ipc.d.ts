// FRPB — Renderer IPC type declarations.
// Single source of truth for the `window.frpb` bridge surface, imported by
// both preload.ts (implementation) and React components (usage).

import type {
  ChipsetFamily,
  DeviceAutoDetected,
  ModelCatalogEntry,
  VerifyStatus,
} from "@frpb/shared";

export type { DeviceAutoDetected, ModelCatalogEntry };

export interface LicenseProfile {
  key: string;
  plan: "MONTH_1" | "YEAR_1" | "LIFETIME";
  planName: string;
  expiresAt: string | null;
  deviceLimit: number;
  devicesUsed: number;
  activatedAt: string;
}

export interface VerifyResponse {
  httpStatus: number;
  success: boolean;
  status: VerifyStatus;
  license?: LicenseProfile;
  message?: string;
}

/** Result of a dev/test activation-state reset (see electron/ipc/reset.ts). */
export interface ResetResult {
  ok: boolean;
  /** Human-readable list of the stores that were actually cleared. */
  cleared: string[];
  /** Absolute path of the encrypted license cache on this machine. */
  cachePath: string;
  error?: string;
}

export type DeviceState = "SEARCHING" | "CONNECTED" | "DRIVER_MISSING";

export type DeviceScanState = "NORMAL" | "RECOVERY" | "SEARCHING" | "NOT_CONNECTED";

export interface DeviceStatus {
  /** Present on the ADB/USB scan payload ("device:getStatus"); absent on the legacy USB poll ("device:status"). */
  connected?: boolean;
  state: DeviceState | DeviceScanState;
  deviceName?: string;
  mode?: string;
  vendor?: string;
  driver?: { oem: string; officialUrl: string };
  lastScanAt: string;
  brand?: string;
  model?: string;
  serial?: string;
  /** true when ADB reports the device as connected but waiting for authorization. */
  authorized?: boolean;
  /** "adb" | "usb" — how the device was detected. */
  source?: "adb" | "usb";
  /** Full Android system properties (read via ADB shell getprop / ro.*). */
  deviceInfo?: DeviceInfo;
  /** Real-time operation log entries (pushed by the engine). */
  logs?: LogEntry[];
  /** Whether an operation is currently running. */
  running?: boolean;
}

/** Single log entry pushed by the operation engine to the console log UI. */
export interface LogEntry {
  stage: string;
  message: string;
  pct: number | null;
  kind: "info" | "warn" | "error" | "ok";
  ts: string;
  /**
   * Monotonic sequence assigned by the main process when the entry is appended
   * to the global run-state buffer. It is the stable, collision-free identity of
   * an entry: the renderer uses it to (a) seed only entries it has not rendered
   * yet — so repeated engine lines (e.g. several "Rebooting…") are kept — and
   * (b) mark everything with `seq <= N` as cleared after a Clear, preventing the
   * rolling buffer from resurrecting cleared lines on the next poll.
   */
  seq?: number;
}

export interface DeviceInfo {
  build: {
    brand: string;
    manufacturer: string;
    manufacturer2: string;
    model: string;
    device: string;
    name: string;
    product: string;
    hardware: string;
    fingerprint: string;
    board: string;
    cpu_abi: string;
    cpu_abi2: string;
  };
  os: {
    version_release: string;
    sdk: string;
    security_patch: string;
    incremental: string;
    preview_sdk: string;
    bootimage_fingerprint?: string;
  };
  hardware: {
    chipset: string;
    platform: string;
    cpu_abi: string;
    board_platform: string;
    serial: string;
    secureboot?: string;
    hardware_type?: string;
  };
  identity: {
    serialno: string;
    wifi_hostname: string;
    product_name: string;
    product_device: string;
    product_board: string;
    product_manufacturer: string;
    product_brand: string;
    build_product: string;
  };
  buildMeta: {
    date: string;
    dateUtc: string;
    versionIncremental: string;
    versionSdk: string;
    versionRelease: string;
    versionSecurityPatch: string;
    versionPreviewSdk: string;
    bootimageBuildFingerprint?: string;
  };
  extra: {
    cpuAbi: string;
    hardware: string;
    manufacturer: string;
    model: string;
    device: string;
    brand: string;
    name: string;
    product: string;
    board: string;
    fingerprint: string;
    platform: string;
    chipset: string;
    serial: string;
    securityPatch: string;
    androidVersion: string;
    sdkVersion: string;
  };
}

export interface DeviceModelsResult {
  models: string[];
  detectedModel?: string;
}

export interface ConsentState {
  flashReset: boolean;
  frpBypass: boolean;
  unlockScreen: boolean;
}

export interface AcceptConsentResult {
  ok: boolean;
  flashReset?: boolean;
  frpBypass?: boolean;
  unlockScreen?: boolean;
  error?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  /** Raw stdout captured from the underlying adb/fastboot process (when any). */
  stdout?: string;
  detail?: string;
}

export type OperationKind = "flash-reset" | "frp-bypass" | "unlock-screen" | "reboot-mode";

/**
 * Reboot targets offered by the Home screen "Quick Boot Switcher" panel. Mapped
 * 1:1 by the main process to `adb reboot bootloader|recovery|edl` — `system`
 * sends a plain `adb reboot` (normal boot).
 */
export type RebootMode = "bootloader" | "recovery" | "edl" | "system";

/**
 * Transport mode the user has been guided into for a locked device (selected
 * brand/method on the method screen). The engine uses it to decide which
 * connection signal counts as "device ready" — an FRP-locked phone cannot
 * reach Android Settings to enable USB debugging, so the engine must not
 * demand ADB for these modes.
 */
export type OperationMode =
  | "test-mode" // Samsung Test Mode (MTP) — dial *#0*# / *#888# / *#808#
  | "brom" // MediaTek BROM / Preloader (VCOM) — hold Vol Up+Down, plug in
  | "fastboot-recovery"; // Fastboot / Recovery — hold Vol Down + Power

/** Optional per-invocation engine guidance for an FRP/Flash operation. */
export interface OperationOptions {
  /** Brand the user selected on the method screen (null = unknown). */
  brand?: string | null;
  /** Transport mode the phone should be in (defaults to fastboot-recovery). */
  mode?: OperationMode;
  /**
   * Optional model string typed by the user. Forwarded to the main process so
   * the chipset handshake can identify the device when no authorized ADB
   * `ro.product.model` readback is available yet.
   */
  model?: string | null;
}

export interface OperationEvent {
  op: OperationKind;
  stage: string;
  message: string;
  pct: number;
}

/** Which pipe a streamed device-log chunk arrived from (`out` from stderr). */
export type DeviceLogStream = "out" | "err";

/**
 * Live stdout/stderr chunk pushed on the "device:log" channel while a real
 * adb/fastboot child process is running. `text` is the raw (un-buffered) chunk
 * so a terminal-style panel can render output as it is produced.
 */
export interface DeviceLogPayload {
  op: OperationKind | null;
  stream: DeviceLogStream;
  text: string;
  ts: string;
}

/**
 * Real-time hardware snapshot pushed on "device:info-updated" by the continuous
 * USB/ADB monitor. Mirrors professional GSM-tool "auto read": the terminal
 * fields (Model / Serial / Port status / Chipset) populate themselves the moment
 * a phone is attached — no manual "Read Info" click required. A snapshot is
 * pushed on connect, disconnect, and any transport/mode transition.
 */
export interface DeviceInfoSnapshot {
  connected: boolean;
  /** Android/ADB serial, or the USB hardware id when only the raw transport is up. */
  serial: string | null;
  model: string | null;
  brand: string | null;
  vendor: string | null;
  /** USB vendor id, lowercase hex (e.g. "0e8d"). */
  vid: string | null;
  /** USB product id, lowercase hex (e.g. "0000"). */
  pid: string | null;
  /** Windows COM port exposed by the device (e.g. "COM7"), null when none. */
  port: string | null;
  /** Detected chipset family: "MediaTek" | "Qualcomm" | "Samsung Exynos" | … */
  chipset: string | null;
  /** Human transport label: "ADB", "Fastboot / Download / BROM", "MTP", … */
  mode: string | null;
  /** MTP/PTP mount description when the device enumerates as a media device. */
  mtp: string | null;
  /** Whether the OEM driver appears installed for the detected vendor. */
  driverInstalled: boolean;
  source: "adb" | "usb" | null;
  lastScanAt: string;
  // ── Low-level hardware transport (raw USB VID/PID + COM; ADB-independent) ──
  /** Classified transport: brom | preloader | edl | fastboot | download | mtp | serial | adb | none. */
  hardwareMode: HardwareMode;
  /** Human label for AUTO-READ HARDWARE, e.g. "MediaTek BROM Mode (0x0003)". */
  hardwareLabel: string;
  /** Windows Device Instance ID, e.g. "USB\\VID_0E8D&PID_0003\\…". */
  deviceInstanceId: string | null;
  /** True when this transport needs a hardware key combination (BROM/EDL). */
  requiresKeyCombo: boolean;
  /** True while a guided hardware listen loop is running. */
  listening: boolean;
}

/**
 * Low-level hardware transport classified from the raw USB VID/PID + interface
 * classes / COM port. Never depends on an ADB session — the whole point is a
 * locked device that cannot enable USB debugging.
 */
export type HardwareMode =
  | "brom"
  | "preloader"
  | "edl"
  | "fastboot"
  | "download"
  | "mtp"
  | "serial"
  | "adb"
  | "none";

/** A raw snapshot of the physical hardware transport currently attached. */
export interface HardwareSnapshot {
  mode: HardwareMode;
  label: string;
  connected: boolean;
  vid: number | null;
  pid: number | null;
  vidHex: string | null;
  pidHex: string | null;
  /** Windows COM port exposed by the device (e.g. "COM3"), null when none. */
  port: string | null;
  chipset: ChipsetFamily;
  /** Windows Device Instance ID, e.g. "USB\\VID_0E8D&PID_0003\\6&1F2A…". */
  deviceInstanceId: string | null;
  /** Friendly PnP name, e.g. "MediaTek USB Port (COM3)". */
  deviceName: string | null;
  listenerActive: boolean;
  requiresKeyCombo: boolean;
  lowLevel: boolean;
  lastScanAt: string;
}

/**
 * Subscribe to the auto-detection engine event ("device:auto-detected"). Fires
 * whenever the background USB/ADB poller observes a device plug in or change
 * state, carrying the brand/serial/port/chipset context used to auto-set the
 * header status badge and the brand-scoped model dropdown. Returns an
 * unsubscribe function.
 */
export type DeviceAutoDetectedEvent = DeviceAutoDetected;

/**
 * Global operation run-state pushed on "device:operation:status" by the main
 * process. Unlike the per-component `OperationEvent` stream, this carries the
 * authoritative `running` flag plus the rolling log buffer so the Console Log
 * tab reflects operations started from ANY tab (cross-tab state isolation),
 * and lets every tab disable conflicting controls while an op is in flight.
 */
export interface OperationRunState {
  running: boolean;
  op: OperationKind | null;
  logs: LogEntry[];
}

export type UpdaterState =
  | "IDLE"
  | "CHECKING"
  | "AVAILABLE"
  | "UP_TO_DATE"
  | "DOWNLOADING"
  | "READY"
  | "ERROR";

export interface UpdaterStatus {
  state: UpdaterState;
  version?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  releaseNotes?: string;
  message?: string;
}

export interface FrpbBridge {
  license: {
    verify: (key: string) => Promise<VerifyResponse>;
    getCachedProfile: () => Promise<LicenseProfile | null>;
  };
  /**
   * Developer/test utilities. `reset()` wipes the encrypted license cache plus
   * renderer web storage and Chromium caches so a fresh activation can be
   * tested; `cacheInfo()` reports where the activation state is persisted.
   */
  system: {
    reset: () => Promise<ResetResult>;
    cacheInfo: () => Promise<{ cachePath: string }>;
  };
  device: {
    status: () => Promise<DeviceStatus>;
    /** Authoritative cross-tab run-state (running flag + rolling log buffer). */
    getRunState: () => Promise<OperationRunState>;
    /**
     * Adopt the authoritative main-process run-state after a renderer restart or
     * a render-crash recovery (the main process keeps running). Returns the same
     * snapshot as `getRunState` so callers can seed their local buffer directly.
     */
    seedLogs: () => Promise<OperationRunState>;
    /**
     * Clear the global rolling log buffer. `upTo` is the highest log `seq` the
     * caller has rendered; the main process drops every entry with `seq <= upTo`
     * (defaults to the full buffer) and rebroadcasts on "device:operation:status"
     * so every subscribed Console surface clears. Entries appended after `upTo`
     * are preserved.
     */
    clearLogs: (upTo?: number) => Promise<void>;
    startPolling: () => Promise<void>;
    stopPolling: () => Promise<void>;
    onStatus: (cb: (status: DeviceStatus) => void) => () => void;
    getStatus: () => Promise<DeviceStatus>;
    listModels: () => Promise<DeviceModelsResult>;
    getDeviceInfo: () => Promise<DeviceInfo>;
    checkConsent: () => Promise<ConsentState>;
    acceptConsent: (operation: OperationKind) => Promise<AcceptConsentResult>;
    flashReset: (options?: OperationOptions) => Promise<OperationResult>;
    frpBypass: (options?: OperationOptions) => Promise<OperationResult>;
    unlockScreen: (options?: OperationOptions) => Promise<OperationResult>;
    /**
     * One-click boot-mode switcher — reboots an authorized ADB device into the
     * requested mode (no data wipe). Progress is streamed on the operation event
     * channel so the Quick Boot Switcher buttons show live spinners + console logs.
     */
    rebootMode: (mode: RebootMode) => Promise<OperationResult>;
    onOperationEvent: (cb: (event: OperationEvent) => void) => () => void;
    onOperationStatus: (cb: (state: OperationRunState) => void) => () => void;
    /**
     * Subscribe to live child_process stdout/stderr chunks ("device:log") so the
     * operation log panel can render real tool output as it streams. Returns an
     * unsubscribe function.
     */
    onLog: (cb: (payload: DeviceLogPayload) => void) => () => void;
    /**
     * Enable/disable rendering live device logs into the shared global console
     * buffer. Enabled by the Console Log tab; disabled elsewhere so only one
     * surface mirrors the raw stream.
     */
    setLogSink: (enabled: boolean) => void;
    /**
     * Subscribe to the continuous auto-read hardware snapshot
     * ("device:info-updated"). Fires the instant a phone is connected and again
     * on every change, so the terminal fields populate themselves. Returns an
     * unsubscribe function.
     */
    onInfoUpdated: (cb: (info: DeviceInfoSnapshot) => void) => () => void;
    /**
     * Subscribe to the auto-detection engine ("device:auto-detected"). The
     * payload carries the detected brand/serial/port/chipset + connection state
     * so the header badge and brand context update the instant a phone is
     * plugged in — no manual "Read Info" click. Returns an unsubscribe function.
     */
    onAutoDetected: (cb: (info: DeviceAutoDetected) => void) => () => void;
    /** On-demand hardware snapshot (same shape as the pushed event). */
    requestInfo: () => Promise<DeviceInfoSnapshot>;
    /**
     * Raw hardware poll with NO ADB dependency — classifies the attached USB/COM
     * transport (MediaTek BROM / Preloader, Qualcomm EDL 9008, Fastboot, Odin
     * download, MTP, serial) from VID/PID + interface classes + Device Instance
     * IDs. Never requires USB debugging.
     */
    hardwareStatus: () => Promise<HardwareSnapshot>;
    /**
     * User-initiated refresh. Forces a FRESH serialport enumeration (bypassing
     * the poll caches) and resolves the freshly-classified snapshot, so a phone
     * plugged in moments ago is detected immediately rather than being masked by
     * a stale cached port list.
     */
    rescan: () => Promise<HardwareSnapshot>;
    /**
     * Actively LISTEN for a low-level transport for up to `timeoutMs`, resolving
     * the moment the target interface appears (or null on timeout). Streams
     * console lines + `device:hardware` snapshots so the Connection Wizard can
     * auto-advance from "Listening…" to "Executing…".
     */
    waitForHardware: (opts?: {
      mode?: OperationMode;
      brand?: string | null;
      timeoutMs?: number;
    }) => Promise<HardwareSnapshot | null>;
    /**
     * Subscribe to raw hardware snapshots emitted while a listen loop is active.
     * Returns an unsubscribe function.
     */
    onHardware: (cb: (snapshot: HardwareSnapshot) => void) => () => void;
    /**
     * Brand/chipset-filtered model catalog for the simplified Step 2 dropdown.
     * Backed by the strongly-typed catalog in `@frpb/shared`.
     */
    searchModels: (opts?: {
      query?: string | null;
      brand?: string | null;
      chipset?: string | null;
    }) => Promise<ModelCatalogEntry[]>;
  };
  links: { openExternal: (url: string) => Promise<void> };
  updater: {
    check: () => Promise<{ started: boolean; error?: string }>;
    download: () => Promise<{ started: boolean }>;
    install: () => Promise<{ started: boolean }>;
    onStatus: (cb: (status: UpdaterStatus) => void) => () => void;
  };
}

declare global {
  interface Window {
    frpb: FrpbBridge;
  }
}
