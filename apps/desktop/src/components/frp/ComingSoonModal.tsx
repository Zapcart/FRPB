import { ArrowLeft, Clock } from "lucide-react";

interface ComingSoonModalProps {
  kind: "wireless" | "unlock" | "location";
  onClose: () => void;
}

const COPY: Record<ComingSoonModalProps["kind"], { title: string; desc: string }> = {
  wireless: {
    title: "Wireless Connection",
    desc: "ADB over Wi-Fi is coming soon. For now, connect your device with a USB cable and enable USB debugging.",
  },
  unlock: {
    title: "Unlock Android Screen",
    desc: "Forgot your PIN, pattern, or password? The unlock tool is being prepared and will be available in a future update.",
  },
  location: {
    title: "Location Change",
    desc: "GPS location change is being prepared and will be available in a future update.",
  },
};

/**
 * "Coming soon" modal for features whose engine operations are not implemented
 * yet (Wireless, Unlock Android Screen, Location Change). Pure UI placeholder.
 */
export default function ComingSoonModal({ kind, onClose }: ComingSoonModalProps) {
  const copy = COPY[kind];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
          <Clock className="h-6 w-6 text-brand-600" />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900">{copy.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{copy.desc}</p>
        <button onClick={onClose} className="frpb-btn-primary mt-5 w-full py-2.5 text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
