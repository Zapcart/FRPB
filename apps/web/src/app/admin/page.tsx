// FRPB — Admin dashboard page (Server Component + client interactive shell).
// Server component: loads analytics server-side so the bearer secret
// (ADMIN_LICENSE_KEY) never reaches the browser. The interactive UI receives the
// preloaded data and uses a Server Action (actions.ts) for refreshes.

import type { Metadata } from "next";
import { loadAdminAnalytics } from "./data";
import ClientAdminShell from "./client-shell";

// Always render fresh: analytics must reflect the latest DB state.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin Analytics | FRPB" };

export default async function AdminPage() {
  const initialData = await loadAdminAnalytics();
  return <ClientAdminShell initialData={initialData} />;
}
