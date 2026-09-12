// FRPB — Device Info Panel component.
// Reads full Android system properties via ADB shell getprop / ro.* and
// renders a detailed device information panel (brand, model, chipset, Android
// version, SDK, security patch, serial, build info, etc.). Mirrors the detail
// level shown by tools like UnlockTool while staying fully legitimate (read-only
// property inspection — no modification).
import { Fragment, useState } from "react";
import { Loader2, AlertTriangle, Cpu } from "lucide-react";
import type { DeviceInfo } from "../lib/ipc";

interface DeviceInfoScreenProps {
  info: DeviceInfo | null;
  loading: boolean;
}

type DeviceInfoTab = "build" | "os" | "hardware" | "identity" | "meta" | "summary";

export default function DeviceInfoScreen({ info, loading }: DeviceInfoScreenProps) {
  // Hooks must run unconditionally, before any early return (Rules of Hooks).
  const [activeTab, setActiveTab] = useState<DeviceInfoTab>("build");

  if (loading) {
    return (
      <div className="frpb-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          <span className="text-sm text-slate-500">Reading device properties…</span>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="frpb-card p-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-slate-800">No device connected</p>
          <p className="text-xs text-slate-500">Connect an Android device via USB to see detailed information.</p>
        </div>
      </div>
    );
  }

  const { build, os, hardware, identity, buildMeta, extra } = info;

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-slate-800 font-mono break-all">
        {value || "—"}
      </span>
    </div>
  );

  const tabs = [
    { key: "build" as const, label: "Build Properties", icon: Cpu },
    { key: "os" as const, label: "OS Details", icon: Cpu },
    { key: "hardware" as const, label: "Hardware", icon: Cpu },
    { key: "identity" as const, label: "Identity", icon: Cpu },
    { key: "meta" as const, label: "Build Meta", icon: Cpu },
    { key: "summary" as const, label: "Summary", icon: Cpu },
  ] as const;

  const section = tabs.find((t) => t.key === activeTab)!;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Device Information</h2>
        </div>
        <span className="text-xs text-slate-400">
          {new Date().toLocaleTimeString()} · {extra.androidVersion}
        </span>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-4 gap-3 p-4">
        <div className="rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Brand</p>
          <p className="mt-1 text-lg font-bold">{extra.brand}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Model</p>
          <p className="mt-1 text-lg font-bold font-mono">{extra.model}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Chipset</p>
          <p className="mt-1 text-lg font-bold">{extra.chipset}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Android</p>
          <p className="mt-1 text-lg font-bold">{extra.androidVersion}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-200 px-4 pt-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === t.key
                ? "border-brand-500 border-b-2 text-brand-700 bg-brand-50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="frpb-card overflow-hidden">
        <div className="divide-y divide-slate-100 p-4">
          {activeTab === "build" && (
            <>
              {row("ro.product.brand", build.brand)}
              {row("ro.product.manufacturer", build.manufacturer)}
              {row("ro.product.manufacturer (2)", build.manufacturer2)}
              {row("ro.product.model", build.model)}
              {row("ro.product.device", build.device)}
              {row("ro.product.name", build.name)}
              {row("ro.build.product", build.product)}
              {row("ro.product.hardware", build.hardware)}
              {row("ro.build.fingerprint", build.fingerprint)}
              {row("ro.build.board", build.board)}
              {row("ro.product.cpu.abi", build.cpu_abi)}
              {row("ro.product.cpu.abi2", build.cpu_abi2)}
            </>
          )}
          {activeTab === "os" && (
            <>
              {row("ro.build.version.release", os.version_release)}
              {row("ro.build.version.sdk", os.sdk)}
              {row("ro.build.version.security_patch", os.security_patch)}
              {row("ro.build.version.incremental", os.incremental)}
              {row("ro.build.version.preview_sdk", os.preview_sdk)}
              {row("ro.bootimage.build.fingerprint", os.bootimage_fingerprint || "—")}
            </>
          )}
          {activeTab === "hardware" && (
            <>
              {row("ro.chipset", hardware.chipset)}
              {row("ro.board.platform", hardware.platform)}
              {row("ro.product.cpu.abi", hardware.cpu_abi)}
              {row("ro.hardware", hardware.hardware_type || "—")}
              {row("ro.serialno", hardware.serial)}
              {row("ro.secureboot", hardware.secureboot || "—")}
            </>
          )}
          {activeTab === "identity" && (
            <>
              {row("ro.serialno", identity.serialno)}
              {row("ro.wifi.hostname", identity.wifi_hostname)}
              {row("ro.product.name", identity.product_name)}
              {row("ro.product.device", identity.product_device)}
              {row("ro.product.board", identity.product_board)}
              {row("ro.product.manufacturer", identity.product_manufacturer)}
              {row("ro.product.brand", identity.product_brand)}
              {row("ro.build.product", identity.build_product)}
            </>
          )}
          {activeTab === "meta" && (
            <>
              {row("ro.build.date", buildMeta.date)}
              {row("ro.build.date.utc", buildMeta.dateUtc)}
              {row("ro.build.version.incremental", buildMeta.versionIncremental)}
              {row("ro.build.version.sdk", buildMeta.versionSdk)}
              {row("ro.build.version.release", buildMeta.versionRelease)}
              {row("ro.build.version.security_patch", buildMeta.versionSecurityPatch)}
              {row("ro.build.version.preview_sdk", buildMeta.versionPreviewSdk)}
              {row("ro.bootimage.build.fingerprint", buildMeta.bootimageBuildFingerprint || "—")}
            </>
          )}
          {activeTab === "summary" && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["CPU ABI", extra.cpuAbi],
                ["Hardware", extra.hardware],
                ["Manufacturer", extra.manufacturer],
                ["Product Name", extra.name],
                ["Product", extra.product],
                ["Board", extra.board],
                ["Fingerprint", extra.fingerprint],
                ["Platform", extra.platform],
                ["Chipset", extra.chipset],
                ["Serial Number", extra.serial],
                ["Security Patch", extra.securityPatch],
                ["Android Version", extra.androidVersion],
                ["SDK Version", extra.sdkVersion],
              ].map(([label, value]) => (
                <Fragment key={label}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-xs font-mono text-slate-700 break-all">{value || "—"}</p>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
