// FRPB — Preload bridge. Exposes a minimal, typed `window.frpb` surface to the
// renderer via contextBridge. Nothing else from Node/Electron leaks through.

import { contextBridge, ipcRenderer } from "electron";
import type {
  AcceptConsentResult,
  ConsentState,
  DeviceAutoDetected,
  DeviceInfo,
  DeviceInfoSnapshot,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  FreeToolOperationEvent,
  FreeToolRunRequest,
  FreeToolRunResult,
  FrpbBridge,
  HardwareSnapshot,
  IcloudBypassOptions,
  IcloudBypassResult,
  IcloudStatus,
  SamsungAccountOptions,
  SamsungAccountResult,
  BootloopOptions,
  BootloopResult,
  FirmwarePackage,
  DataRecoveryOptions,
  DataRecoveryScanResult,
  DataRecoveryExtractResult,
  LicenseProfile,
  LicenseSession,
  ModelCatalogEntry,
  OperationEvent,
  OperationKind,
  OperationOptions,
  OperationResult,
  OperationRunState,
  RebootMode,
  ResetResult,
  UpdaterStatus,
  VerifyResponse,
} from "../src/lib/ipc";

function onChannel<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const bridge: FrpbBridge = {
  license: {
    verify: (key: string): Promise<VerifyResponse> =>
      ipcRenderer.invoke("license:verify", key),
    getCachedProfile: (): Promise<LicenseProfile | null> =>
      ipcRenderer.invoke("license:getCachedProfile"),
    getSession: (): Promise<LicenseSession | null> =>
      ipcRenderer.invoke("license:getSession"),
    clearSession: (): Promise<{ ok: boolean; removed: boolean }> =>
      ipcRenderer.invoke("license:clearSession"),
  },
  system: {
    reset: (): Promise<ResetResult> => ipcRenderer.invoke("app:reset"),
    cacheInfo: (): Promise<{ cachePath: string }> => ipcRenderer.invoke("app:cacheInfo"),
  },
  device: {
    status: (): Promise<DeviceStatus> => ipcRenderer.invoke("device:status"),
    getRunState: (): Promise<OperationRunState> =>
      ipcRenderer.invoke("device:getRunState"),
    seedLogs: (): Promise<OperationRunState> =>
      ipcRenderer.invoke("device:seedLogs"),
    clearLogs: (upTo?: number): Promise<void> =>
      ipcRenderer.invoke("device:clearLogs", upTo),
    startPolling: (): Promise<void> => ipcRenderer.invoke("device:startPolling"),
    stopPolling: (): Promise<void> => ipcRenderer.invoke("device:stopPolling"),
    onStatus: (cb: (status: DeviceStatus) => void): (() => void) =>
      onChannel<DeviceStatus>("device:status-changed", cb),
    getStatus: (): Promise<DeviceStatus> => ipcRenderer.invoke("device:getStatus"),
    listModels: (): Promise<DeviceModelsResult> =>
      ipcRenderer.invoke("device:listModels"),
    getDeviceInfo: (): Promise<DeviceInfo> =>
      ipcRenderer.invoke("device:getDeviceInfo"),
    getHardwareId: (deviceLabel?: string): Promise<string> =>
      ipcRenderer.invoke("device:getHardwareId", deviceLabel),
    checkConsent: (): Promise<ConsentState> =>
      ipcRenderer.invoke("device:checkConsent"),
    acceptConsent: (operation: OperationKind): Promise<AcceptConsentResult> =>
      ipcRenderer.invoke("device:acceptConsent", operation),
    flashReset: (options?: OperationOptions): Promise<OperationResult> =>
      ipcRenderer.invoke("device:flashReset", options),
    frpBypass: (options?: OperationOptions): Promise<OperationResult> =>
      ipcRenderer.invoke("device:frpBypass", options),
    unlockScreen: (options?: OperationOptions): Promise<OperationResult> =>
      ipcRenderer.invoke("device:unlockScreen", options),
    rebootMode: (mode: RebootMode): Promise<OperationResult> =>
      ipcRenderer.invoke("device:rebootMode", mode),
    onOperationEvent: (cb: (event: OperationEvent) => void): (() => void) =>
      onChannel<OperationEvent>("device:operation:event", cb),
    onOperationStatus: (cb: (state: OperationRunState) => void): (() => void) =>
      onChannel<OperationRunState>("device:operation:status", cb),
    onLog: (cb: (payload: DeviceLogPayload) => void): (() => void) =>
      onChannel<DeviceLogPayload>("device:log", cb),
    setLogSink: (enabled: boolean): void => {
      // Toggle whether the main process mirrors raw device output into the
      // shared global console. Only the Console Log tab enables it so the raw
      // stream is never duplicated across surfaces.
      ipcRenderer.send("device:setLogSink", Boolean(enabled));
    },
    onInfoUpdated: (cb: (info: DeviceInfoSnapshot) => void): (() => void) =>
      onChannel<DeviceInfoSnapshot>("device:info-updated", cb),
    onAutoDetected: (cb: (info: DeviceAutoDetected) => void): (() => void) =>
      onChannel<DeviceAutoDetected>("device:auto-detected", cb),
    requestInfo: (): Promise<DeviceInfoSnapshot> =>
      ipcRenderer.invoke("device:requestInfo"),
    hardwareStatus: (): Promise<HardwareSnapshot> =>
      ipcRenderer.invoke("device:hardware:status"),
    /**
     * User-initiated refresh. Forces a FRESH serialport enumeration (bypassing
     * the poll caches) and resolves the freshly-classified snapshot, so a phone
     * plugged in moments ago is detected immediately.
     */
    rescan: (): Promise<HardwareSnapshot> => ipcRenderer.invoke("device:rescan"),
    waitForHardware: (opts?: {
      mode?: "test-mode" | "brom" | "fastboot-recovery" | "recovery";
      brand?: string | null;
      timeoutMs?: number;
    }): Promise<HardwareSnapshot | null> => ipcRenderer.invoke("device:hardware:wait", opts),
    onHardware: (cb: (snapshot: HardwareSnapshot) => void): (() => void) =>
      onChannel<HardwareSnapshot>("device:hardware", cb),
    searchModels: (opts?: {
      query?: string | null;
      brand?: string | null;
      chipset?: string | null;
    }): Promise<ModelCatalogEntry[]> =>
      ipcRenderer.invoke("device:searchModels", opts),
    /** Apple iCloud Activation Lock bypass */
    icloudBypass: (options?: IcloudBypassOptions): Promise<IcloudBypassResult> =>
      ipcRenderer.invoke("device:icloudBypass", options),
    /** Poll iCloud bypass status by request ID */
    icloudStatus: (requestId: string): Promise<IcloudStatus> =>
      ipcRenderer.invoke("device:icloudStatus", requestId),
    /** Detect connected Apple device and return IMEI/state */
    icloudDetect: (): Promise<IcloudStatus | null> =>
      ipcRenderer.invoke("device:icloudDetect"),
    /** Samsung Account (Knox/Find My Mobile) lock bypass */
    samsungAccountBypass: (options?: SamsungAccountOptions): Promise<SamsungAccountResult> =>
      ipcRenderer.invoke("device:samsungAccountBypass", options),
    /** Bootloop/Brick recovery — full firmware flash */
    bootloopRecovery: (options?: BootloopOptions): Promise<BootloopResult> =>
      ipcRenderer.invoke("device:bootloopRecovery", options),
    /** List available firmware packages for bootloop recovery */
    listFirmwarePackages: (): Promise<FirmwarePackage[]> =>
      ipcRenderer.invoke("device:listFirmwarePackages"),
    /** Data recovery — scan connected device for recoverable data */
    dataRecoveryScan: (options?: DataRecoveryOptions): Promise<DataRecoveryScanResult> =>
      ipcRenderer.invoke("device:dataRecoveryScan", options),
    /** Data recovery — extract selected items to local disk */
    dataRecoveryExtract: (itemIds: string[], destPath: string): Promise<DataRecoveryExtractResult> =>
      ipcRenderer.invoke("device:dataRecoveryExtract", itemIds, destPath),
  },
  freeTools: {
    run: (request: FreeToolRunRequest): Promise<FreeToolRunResult> =>
      ipcRenderer.invoke("device:freeTool:run", request),
    onEvent: (cb: (event: FreeToolOperationEvent) => void): (() => void) =>
      onChannel<FreeToolOperationEvent>("device:freeTool:event", cb),
  },
  links: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke("links:openExternal", url),
  },
  updater: {
    check: (): Promise<{ started: boolean; error?: string }> =>
      ipcRenderer.invoke("check-for-updates"),
    download: (): Promise<{ started: boolean }> =>
      ipcRenderer.invoke("download-update"),
    install: (): Promise<{ started: boolean }> =>
      ipcRenderer.invoke("quit-and-install"),
    onStatus: (cb: (status: UpdaterStatus) => void): (() => void) =>
      onChannel<UpdaterStatus>("updater:status", cb),
  },
};

contextBridge.exposeInMainWorld("frpb", bridge);


