// FRPB — Admin dashboard page (Server Component + client interactive shell).
//
// Renders the dashboard DIRECTLY at /admin when the request is authorized, and a
// clean owner-key entry form when it is not — instead of redirecting to /auth or
// crashing with a 503 "Admin analytics is not configured".
//
// Authorization (see lib/admin/access.ts) accepts either a verified owner key
// (`?key=` hand-off / HttpOnly cookie) or a signed-in Supabase user. Analytics are
// loaded server-side so the bearer secret (ADMIN_LICENSE_KEY) never reaches the
// browser.

import { loadAdminAnalytics } from "./data";
import ClientAdminShell from "./client-shell";
import AdminKeyGate from "./key-gate";
import { resolveAdminAccess } from "@/lib/admin/access";
import { pageMetadata } from "@/lib/seo";

// Always render fresh: analytics must reflect the latest DB state, and access is
// decided per-request from the cookie jar.
export const dynamic = "force-dynamic";

// Internal admin console — keep it out of the index entirely.
export const metadata = {
  ...pageMetadata({
    title: "Admin Analytics",
    description: "Internal FRPB analytics console.",
    path: "/admin",
  }),
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await resolveAdminAccess();

  // Unauthorized → render the key form (not a redirect, not an error page).
  if (!access.authorized) {
    return <AdminKeyGate />;
  }

  // Authorized → load the data server-side. loadAdminAnalytics() returns null
  // rather than throwing, and the client shell then shows its own loading/error
  // state, so a DB outage degrades gracefully instead of 503-ing.
  const initialData = await loadAdminAnalytics();
  return <ClientAdminShell initialData={initialData} />;
}
