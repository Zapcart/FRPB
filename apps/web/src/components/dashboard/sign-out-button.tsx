// FRPB — dashboard sign-out button.
// Client component: clears the Supabase session through the browser client
// (which operates on the persisted cookies) and then does a client-side
// navigation home. Using the browser client avoids a server action that
// re-reads cookies, so signing out never disturbs other tabs mid-transition.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  className: string;
  label: string;
  open?: boolean;
}

export default function SignOutButton({ className, label, open }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy || pending) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      // Clear the client router cache so no stale server-rendered auth
      // payload lingers, then leave the protected area.
      startTransition(() => {
        router.replace("/");
        router.refresh();
      });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy || pending}
      className={className}
    >
      {busy || pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {open ? label : null}
    </button>
  );
}
