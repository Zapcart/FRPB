// FRPB — Preload bridge. Exposes a minimal, typed `window.frpb` surface to the
// renderer via contextBridge. Nothing else from Node/Electron leaks through.

import { contextBridge, ipcRenderer } from "electron";
import type {
  AcceptConsentResult,
  ConsentState,
  DeviceInfo,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  FrpbBridge,
  LicenseProfile,
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
    checkConsent: (): Promise<ConsentState> =>
      ipcRenderer.invoke("device:checkConsent"),
    acceptConsent: (operation: OperationKind): Promise<AcceptConsentResult> => {
      if (operation !== "flash-reset" && operation !== "frp-bypass" && operation !== "unlock-screen") {
        return Promise.resolve({
          ok: false,
          error: `Unknown operation: ${String(operation)}`,
        });
      }
      return ipcRenderer.invoke("device:acceptConsent", operation);
    },
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


