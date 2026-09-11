import Link from "next/link";
import {
  Download,
  ShieldCheck,
  MonitorDown,
  CheckCircle2,
  FileDown,
  Smartphone,
} from "lucide-react";

export const metadata = {
  title: "Downloads — FRPB",
  description:
    "Download the FRPB desktop app for Windows 10/11. Fix boot loops, restore firmware, install OEM drivers and manage your Android & iOS devices.",
};

const EXE_NAME = "FRPB-Setup.exe";

function downloadTarget(): string {
  // NEXT_PUBLIC_DOWNLOAD_URL points at the full installer URL
  // (e.g. https://frpb.in/downloads/FRPB-Setup.exe). Prefer it when set.
  const direct = process.env.NEXT_PUBLIC_DOWNLOAD_URL;
  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }
  const base = process.env.DOWNLOAD_BASE_URL || "/downloads";
  return `${base}/${EXE_NAME}`;
}

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Safe & Verified",
    desc: "Signed installer with SHA-256 checksum. No adware, no bundled toolbars.",
  },
  {
    icon: MonitorDown,
    title: "Windows 10 / 11",
    desc: "Native x64 build tuned for the latest Windows releases. 64-bit only.",
  },
  {
    icon: Smartphone,
    title: "Device Toolkit",
    desc: "Boot-loop fix, firmware restore, OEM drivers, FRP tools and live USB monitor.",
  },
];

export default function DownloadsPage() {
  const href = downloadTarget();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white shadow-lg shadow-brand-500/30">
              F
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="btn-ghost px-4 py-2 text-xs sm:text-sm">
              Pricing
            </Link>
            <Link href="/" className="btn-accent hidden px-4 py-2 text-xs sm:inline-flex md:text-sm">
              <FileDown className="h-4 w-4" />
              Home
            </Link>
          </div>
        </nav>
      </header>

      {/* ================= HERO / DOWNLOAD CARD ================= */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-4 py-1.5 text-xs font-semibold text-brand-700">
              <Download className="h-3.5 w-3.5" />
              FRPB v1.0 — Official Download
            </div>

            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              Download FRPB for{" "}
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
                Windows
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              The complete desktop toolkit for Android & iOS. Fix boot loops, restore
              firmware, install OEM drivers and manage your devices — all in one app.
            </p>

            {/* Primary CTA — links straight to the .exe */}
            <a
              href={href}
              download
              className="btn-accent mt-9 w-full max-w-md px-8 py-4 text-base shadow-blue-glow sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Download FRPB for Windows (.exe)
            </a>

            <p className="mt-4 text-xs text-slate-400">
              {EXE_NAME} · ~180 MB · Windows 10/11 · Free trial available
            </p>

            {/* Version + checksum strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              <span className="badge">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Version 1.0.1
              </span>
              <span className="badge">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
                Signed installer
              </span>
              <span className="badge">x64</span>
            </div>
          </div>
        </div>

        {/* ================= HIGHLIGHTS ================= */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="card p-6">
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* ================= FAQ ================= */}
        <section className="mt-14">
          <h2 className="text-center text-lg font-bold text-ink">Frequently asked questions</h2>
          <div className="mx-auto mt-6 max-w-3xl space-y-3">
            {[
              {
                q: "Is FRPB free?",
                a: "Yes — FRPB offers a free trial with no credit card required. A paid license unlocks the full FRP toolkit and priority support.",
              },
              {
                q: "Will it work on my Windows version?",
                a: "FRPB supports Windows 10 and Windows 11 (64-bit). Older 32-bit systems are not supported.",
              },
              {
                q: "Is the download safe?",
                a: "The installer is code-signed and hosted on our official servers. Always verify you are downloading from frpb.in or the official FRPB GitHub releases page.",
              },
            ].map((faq) => (
              <details key={faq.q} className="card group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
                  {faq.q}
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} FRPB. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/" className="transition hover:text-slate-900">
              Home
            </Link>
            <Link href="/pricing" className="transition hover:text-slate-900">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
