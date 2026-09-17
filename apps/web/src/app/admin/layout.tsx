// FRPB — Admin layout (access-aware shell).
//
// ACCESS: the route is reachable two ways — a verified owner key (via the
// `?key=` hand-off or the HttpOnly cookie) or a signed-in Supabase user. See
// lib/admin/access.ts.
//
// This layout deliberately NO LONGER redirects to /auth on an unauthenticated
// visit. That redirect made /admin unusable for the owner holding the command
// key and turned a missing session into a dead end; the page now renders an
// in-place key entry form instead. It also no longer calls the throwing
// `createClient()` — a missing Supabase config must not crash the console.
//
// Secrets (ADMIN_LICENSE_KEY) never reach the client; access is resolved
// server-side and only a boolean crosses the boundary.

import Link from "next/link";
import { LayoutDashboard, BarChart3, ShieldCheck } from "lucide-react";
import { resolveAdminAccess } from "@/lib/admin/access";
import SignOutButton from "@/components/dashboard/sign-out-button";
import { pageMetadata } from "@/lib/seo";

// Internal admin console — keep it out of the index entirely.
export const metadata = {
  ...pageMetadata({
    title: "Admin",
    description: "Internal FRPB admin console.",
    path: "/admin",
  }),
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Never throws: falls back to `authorized: false` when auth is misconfigured.
  const access = await resolveAdminAccess();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navbar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-brand-600" />
              <span className="text-lg font-bold text-slate-900">FRPB</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              <BarChart3 className="h-3.5 w-3.5" />
              Admin Panel
            </span>
          </div>
          {/* Dashboard/logout links only make sense for a signed-in Supabase
              user; an owner-key session has no account to sign out of. */}
          {access.via === "user" && (
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Back to Dashboard
              </Link>
              <SignOutButton
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                label="Logout"
              />
            </nav>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>

      {/* Footer note */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-slate-400">
          FRPB Admin Panel — Restricted Access
        </div>
      </footer>
    </div>
  );
}
