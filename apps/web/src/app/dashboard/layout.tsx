// FRPB — dashboard layout
// Server component: resolves the session + user's licenses, then renders the
// dashboard shell with the license data passed down to client views.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Download, LogOut, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Dashboard" };

// Session + DB work — never statically prerender the dashboard shell.
export const dynamic = "force-dynamic";

// Shared query shape so the sidebar + try/catch keep full type safety on the
// `licenses`/`plan` relations (ReturnType<typeof findUnique> would drop them).
const userLicensesInclude = {
  licenses: {
    orderBy: { createdAt: "desc" as const },
    include: { plan: true },
  },
} satisfies Prisma.UserInclude;

type UserWithLicenses = Prisma.UserGetPayload<{
  include: typeof userLicensesInclude;
}>;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    // Preserve the exact deep link the user was heading to. Middleware stamps
    // the original pathname as `x-pathname`; fall back to /dashboard when
    // absent (e.g. direct server render without middleware).
    const headerStore = headers();
    const requestedPath = headerStore.get("x-pathname");
    const returnTo =
      requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/dashboard";
    redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // Keep the dashboard data fresh: the user's email is the join key.
  // Isolated in try/catch so a DB outage never crashes the shell — the shell
  // still renders so the user can sign out or retry from the client views.
  let user: UserWithLicenses | null = null;
  let dbUnreachable = false;
  try {
    user = await prisma.user.findUnique({
      where: { email: authUser.email! },
      include: userLicensesInclude,
    });
  } catch (err) {
    console.error("[dashboard/layout] Failed to load user licenses from DB:", err);
    dbUnreachable = true;
  }

  const email = authUser.email ?? "";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white">
            F
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">FRPB</span>
        </Link>

        <nav className="flex flex-col gap-1">
          <span className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </span>
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Download className="h-4 w-4" /> Downloads
          </Link>
        </nav>

        <div className="mt-auto space-y-3 border-t border-slate-200 pt-4">
          <div className="px-1 text-xs text-slate-500">
            <p className="truncate font-medium text-slate-700">{email}</p>
            {user?.licenses.length ? (
              <p>
                {user.licenses.length} license{user.licenses.length === 1 ? "" : "s"}
              </p>
            ) : (
              <p>No licenses yet</p>
            )}
          </div>
          <form
            action={async () => {
              "use server";
              const supabase = createClient();
              await supabase.auth.signOut({ scope: "local" });
              redirect("/");
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
            <span className="text-xs text-slate-500">{email}</span>
          </div>
        </header>
        {dbUnreachable ? (
          <div
            role="alert"
            className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-800"
          >
            We couldn't load your license data right now. Please try again in a
            moment — your licenses are safe.
          </div>
        ) : null}
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
