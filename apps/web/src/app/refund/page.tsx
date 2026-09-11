// FRPB — Refund Policy
// Server component. Static legal page explaining our refund policy for
// monthly, yearly and lifetime plans.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "FRPB refund policy — what is refundable, when, and how to request a refund",
  openGraph: { title: "FRPB Refund Policy" },
};

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <a href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="FRPB"
              className="h-9 w-9 shrink-0 rounded-xl"
            />
            <span className="text-lg font-extrabold tracking-tight text-ink">
              FRPB
            </span>
          </a>

          <nav className="hidden items-center gap-5 lg:flex">
            <a
              href="#"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to home
            </a>
          </nav>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Legal
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Refund Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Last updated:{" "}
          <time dateTime={new Date().toISOString().slice(0, 10)}>
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>

        <div className="mt-8 max-w-2xl text-base leading-relaxed text-slate-700 space-y-8">
          <section>
            <h2 className="text-lg font-bold text-ink">1. General Principle</h2>
            <p>
              FRPB wants you to be happy with your purchase. If a plan is not right for
              you, we offer refunds under the conditions described below. Our refund
              policy applies to all purchases made directly through the FRPB website or
              the FRPB checkout. Purchases made through third-party app stores or
              resellers are subject to that store’s or reseller’s refund policy, not
              ours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. Monthly and Yearly Subscriptions
            </h2>
            <p>
              For monthly and yearly subscription plans:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                You may request a refund within <strong>seven (7) days</strong> of the
                date of purchase if you have not used the plan beyond a brief trial.
              </li>
              <li>
                If your subscription is cancelled within the refund window and no
                significant recovery work has been performed, we will refund the amount
                you paid for that billing period, excluding any taxes we were required to
                collect.
              </li>
              <li>
                Refunds are processed to the original payment method. Depending on your
                bank or payment provider, the refund may appear on your statement within
                a few business days.
              </li>
              <li>
                After the seven-day window, monthly and yearly subscriptions are not
                eligible for a refund. Cancellations after this window stop future
                renewals but do not generate a refund for fees already paid.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              3. Lifetime License
            </h2>
            <p>
              Lifetime licences are non-refundable once the license key has been
              activated or the Software has been downloaded and used.
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                If you purchased a lifetime licence but have <strong>not</strong>
                activated the key or used the Software, you may request a refund within
                seven (7) days of purchase.
              </li>
              <li>
                Once a lifetime key has been activated on any device, or the Software has
                been used in any way, the purchase is considered final and is not
                eligible for a refund.
              </li>
              <li>
                This policy reflects the nature of a lifetime licence — once delivered and
                used, the value has been consumed.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. Payment Errors and Duplicate Charges
            </h2>
            <p>
              If you were charged more than once for the same purchase, or charged for a
              plan you did not receive, please contact us immediately and we will work to
              correct the error, including issuing a refund where appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. Technical Issues Not Resolved
            </h2>
            <p>
              If you purchased a plan and the Software does not function as described in
              our documentation, and we have been unable to resolve the issue within a
              reasonable time after you contacted support, we may, at our discretion,
              offer a refund or a replacement plan. This is not guaranteed and will be
              assessed case by case.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">6. Non-Refundable Cases</h2>
            <p>The following are generally <strong>not</strong> eligible for a refund:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>A license key that has already been activated.</li>
              <li>A subscription that has been used beyond the seven-day window.</li>
              <li>A purchase made outside our official checkout (e.g. via a third-party
                reseller or app store).</li>
              <li>A refund request submitted after the applicable refund window.</li>
              <li>Changes of mind where the Software was used as intended.</li>
              <li>A refund request that appears to be an abuse of our refund policy
                (e.g. repeated refunds for the same plan).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              7. How to Request a Refund
            </h2>
            <p>
              To request a refund, email{" "}
              <a
                href="mailto:support@frpb.in"
                className="text-brand-600 hover:underline"
              >
                support@frpb.in
              </a>{" "}
              with the subject line “Refund Request”. Please include:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Your FRPB account email address.</li>
              <li>The order ID or transaction ID if you have it.</li>
              <li>The plan you purchased and the date of purchase.</li>
              <li>A brief explanation of why you are requesting a refund.</li>
            </ul>
            <p>
              We will review your request and respond by email within a reasonable time.
              If your request is approved, the refund will be issued to your original
              payment method.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Refund Processing Time
            </h2>
            <p>
              Once a refund is approved, it is typically processed within <strong>five
              (5) to seven (7) business days</strong>. The actual time for the funds to
              appear in your account depends on your bank or payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">9. Changes to This Policy</h2>
            <p>
              We may update this Refund Policy from time to time. If we make a material
              change, we will notify you by email or a notice on our website. The “Last
              updated” date at the top reflects the latest revision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">10. Contact Us</h2>
            <p>
              Questions about refunds or this policy:
            </p>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
              <a
                href="mailto:support@frpb.in"
                className="text-brand-600 hover:underline"
              >
                support@frpb.in
              </a>
              <p>FRPB, India</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
