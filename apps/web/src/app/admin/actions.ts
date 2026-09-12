// FRPB — Admin analytics Server Action.
//
// This module runs on the server ONLY ("use server"), so the private owner key
// (ADMIN_LICENSE_KEY) and the Prisma queries never reach the browser bundle.
// The client shell calls it to refresh data; it re-checks the Supabase session
// on every invocation so it cannot be abused as an unauthenticated data source.

"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";

export interface RefreshAnalyticsResult {
  ok: boolean;
  data?: AdminAnalyticsResponse;
  error?: string;
}

export async function refreshAdminAnalytics(): Promise<RefreshAnalyticsResult> {
  // Defense in depth: the layout already guards the route, but a Server Action
  // is a public POST endpoint and must verify the caller independently.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const data = await getAdminAnalytics();
  if (!data) {
    return { ok: false, error: "Admin analytics is not configured" };
  }

  return { ok: true, data };
}
