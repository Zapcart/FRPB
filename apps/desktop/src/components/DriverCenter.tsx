import { Download, ExternalLink } from "lucide-react";

interface DriverInfo {
  oem: string;
  title: string;
  description: string;
  url: string;
}

// All URLs below match the allow-list enforced in electron/ipc/links.ts.
const DRIVERS: DriverInfo[] = [
  {
    oem: "Samsung",
    title: "Samsung USB Driver",
    description: "Required for Samsung devices in Download mode, Odin flashing and MTP transfers.",
    url: "https://developer.samsung.com/android-usb-driver",
  },
  {
    oem: "Google",
    title: "Google USB Driver",
    description: "For Google Pixel and Nexus devices — needed for ADB and fastboot access.",
    url: "https://developer.android.com/studio/run/oem-usb",
  },
  {
    oem: "OnePlus",
    title: "OnePlus USB Driver",
    description: "Official driver for OnePlus devices, including EDL mode support.",
    url: "https://www.oneplus.com/support/faq",
  },
  {
    oem: "MediaTek",
    title: "MediaTek USB VCOM Driver",
    description: "For MediaTek-powered devices in BROM/Preloader mode (SP Flash Tool flashing).",
    url: "https://support.mediatek.com",
  },
  {
    oem: "Qualcomm",
    title: "Qualcomm QDLoader Driver",
    description: "For Qualcomm Snapdragon devices in EDL mode (9008), used by QPST tools.",
    url: "https://www.qualcomm.com",
  },
  {
    oem: "Apple",
    title: "Apple Mobile Device Driver",
    description: "For iPhone and iPad recovery mode. Installed with iTunes on Windows.",
    url: "https://support.apple.com",
  },
];

/**
 * Static catalog of official OEM drivers. Each card opens the manufacturer's
 * download page through the main process allow-list (never in-app navigation).
 */
export default function DriverCenter() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {DRIVERS.map((driver) => (
        <div key={driver.oem} className="frpb-card flex flex-col p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
              <Download className="h-4 w-4 text-white" />
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{driver.title}</h3>
          </div>
          <p className="flex-1 text-xs leading-relaxed text-slate-500">{driver.description}</p>
          <button
            onClick={() => window.frpb.links.openExternal(driver.url).catch(() => {})}
            className="frpb-btn-ghost mt-4 w-full"
          >
            <ExternalLink className="h-4 w-4" />
            Visit {driver.oem} download page
          </button>
        </div>
      ))}
    </div>
  );
}
