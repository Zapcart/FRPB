// FRPB — floating referral promo widget (Dr.Fone style).
//
// Fixed bottom-right marketing card that advertises the referral programme and
// opens the ReferralModal. Dismissal is scoped to the current browser session
// (sessionStorage) so it reappears on the next visit but never nags within one.
//
// Mounted code-split (ssr:false) alongside SocialUpdatesWidget via
// `components/floating-widgets.tsx`.

"use client";

import { useEffect, useState } from "react";
import { Gift, Share2, X } from "lucide-react";
import ReferralModal from "@/components/referral/ReferralModal";

/** Session-scoped dismissal key (cleared when the tab/session ends). */
const DISMISS_KEY = "frpb.promo.dismissed";

export interface FloatingPromoWidgetProps {
  /** Signed-in buyer email, forwarded to the modal for downsell checkout. */
  email?: string | null;
}

export default function FloatingPromoWidget({ email }: FloatingPromoWidgetProps) {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Show only if the visitor has not dismissed it during this session.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
    } catch (err) {
      // Private-mode / storage-blocked browsers: fail open (still show the promo).
      console.error("[referral/promo] sessionStorage read failed:", err);
      setVisible(true);
    }
  }, []);

  function handleDismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch (err) {
      console.error("[referral/promo] sessionStorage write failed:", err);
    }
  }

  return (
    <>
      {visible && (
        <div className="fixed bottom-6 right-6 z-40 print:hidden">
          <div className="relative w-full max-w-sm rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-900 to-indigo-950 p-4 text-white shadow-2xl">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss referral promotion for this session"
              className="absolute right-2 top-2 grid h-8 w-8 touch-manipulation place-items-center rounded-full text-blue-200/80 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-indigo-900/40">
                <Gift className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-bold leading-snug">
                  Refer Friends & Unlock 100% FREE $150 Lifetime Plan!
                </p>
                <p className="mt-1 text-xs text-blue-100/90">
                  Invited friends get 20% OFF Lifetime Plan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-3 inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-blue-400 hover:to-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Share2 className="h-4 w-4" /> Get Referral Link
            </button>
          </div>
        </div>
      )}

      <ReferralModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email={email}
      />
    </>
  );
}
