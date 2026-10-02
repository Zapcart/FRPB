// FRPB — shared auth shell (server component).
// Renders the header/footer chrome used by /auth, /login and /register so the
// three routes stay visually identical.

import Image from "next/image";
import Link from "next/link";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* Soft aurora canvas so the frosted auth card reads as glass. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-canvas-mesh"
      />
      <header className="glass-nav sticky top-0 z-20">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="FRPB"
              width={32}
              height={32}
              priority
              className="h-8 w-8 shrink-0 rounded-lg"
            />
            <span className="text-lg font-bold tracking-tight text-slate-900">FRPB</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 active:text-brand-600"
            >
              Pricing
            </Link>
            <Link
              href="/"
              className="btn-ghost inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-lg px-4 py-2 text-sm font-medium"
            >
              Back to home
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {children}
      </main>

      <footer className="border-t border-glass-edge py-6">
        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} FRPB — Intended for authorized device owners only.
        </p>
      </footer>
    </div>
  );
}
