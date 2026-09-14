// FRPB — Admin dashboard page (Server Component + client interactive shell).
// Server component: loads analytics server-side so the bearer secret
// (ADMIN_LICENSE_KEY) never reaches the browser. The interactive UI receives the
// preloaded data and uses a Server Action (actions.ts) for refreshes.

import { loadAdminAnalytics } from "./data";
import ClientAdminShell from "./client-shell";
import { pageMetadata } from "@/lib/seo";

// Always render fresh: analytics must reflect the latest DB state.
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
  const initialData = await loadAdminAnalytics();
  return <ClientAdminShell initialData={initialData} />;
}
