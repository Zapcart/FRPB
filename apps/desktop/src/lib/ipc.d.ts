// FRPB — Renderer IPC type declarations.
// Single source of truth for the `window.frpb` bridge surface, imported by
// both preload.ts (implementation) and React components (usage).

import type { VerifyStatus } from "@frpb/shared";

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
}

export interface AcceptConsentResult {
  ok: boolean;
  flashReset?: boolean;
  frpBypass?: boolean;
  error?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  detail?: string;
}

export type OperationKind = "flash-reset" | "frp-bypass";

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
}

export interface OperationEvent {
  op: OperationKind;
  stage: string;
  message: string;
  pct: number;
}

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
    onOperationEvent: (cb: (event: OperationEvent) => void) => () => void;
    onOperationStatus: (cb: (state: OperationRunState) => void) => () => void;
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
