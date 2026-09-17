// FRPB — /checkout/upi (Direct UPI rail).
//
// Destination for the "Pay in INR (UPI / Direct)" choice in the payment-method
// modal. Renders the self-hosted Direct-UPI checkout: a dynamic QR for desktop
// or native UPI intent buttons for mobile, settling straight to the merchant
// VPA alixpay@axl.
//
// `?orderId=…` lets the modal hand over an order it already created (so the QR
// is immediate); with no orderId the page starts a fresh one for the plan in
// `?plan=`. Either way the amount is locked server-side to the INR tier rate.

import { createClient } from "@/lib/supabase/server";
import DirectUpiCheckout from "@/components/checkout/direct-upi-checkout";
import { getDualPlan } from "@/config/plans";
import { pageMetadata } from "@/lib/seo";
import type { UpiPlanId } from "@/lib/upi";

export const dynamic = "force-dynamic";

// Purchase hand-off — transactional, never indexed.
export const metadata = {
  ...pageMetadata({
    title: "UPI Checkout",
    description: "Pay for your FRPB license directly via UPI.",
    path: "/checkout/upi",
  }),
  robots: { index: false, follow: false },
};

interface UpiCheckoutPageProps {
  searchParams?: { plan?: string; orderId?: string };
}

export default async function UpiCheckoutPage({ searchParams }: UpiCheckoutPageProps) {
  // Map the shared plan slug (or the public UPI plan id) to the plan the
  // customer clicked, so the correct tier is pre-selected on arrival.
  const rawPlan = searchParams?.plan ?? "";
  const plan = getDualPlan(rawPlan);
  const initialPlanId: UpiPlanId | null =
    (plan?.orderPlanId as UpiPlanId | undefined) ?? null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <DirectUpiCheckout
        defaultEmail={user?.email ?? null}
        initialPlanId={initialPlanId}
      />
    </main>
  );
}
