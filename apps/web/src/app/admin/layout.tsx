// FRPB — Admin layout (auth guard + page shell)
// Server component: requires Supabase auth. Redirects to /auth if unauthenticated.
// The admin page (children) loads analytics server-side via a Server Component
// that calls the shared Prisma query layer directly — the ADMIN_LICENSE_KEY and
// all other secrets stay on the server and are never exposed to the client.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, BarChart3, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/dashboard/sign-out-button";

export const metadata: Metadata = { title: "Admin Dashboard | FRPB" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?returnTo=/admin");
  }

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
