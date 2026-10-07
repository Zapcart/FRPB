// FRPB — Refund Policy
// Server component. Static legal page describing the 7-day money-back guarantee,
// ineligible scenarios, the refund submission procedure, and licence
// deactivation on approval.

import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import {
  COMPANY_NAME,
  LEGAL_EMAIL,
  LEGAL_LOCATION,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

export const metadata = pageMetadata({
  title: "Refund Policy",
  description:
    "FRPB refund policy — our 7-day money-back guarantee, ineligible refund scenarios, how to submit a refund request, and licence deactivation on approval.",
  path: "/refund",
});

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <a href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="FRPB"
              width={36}
              height={36}
              priority
              className="h-9 w-9 shrink-0 rounded-xl"
            />
            <span className="text-lg font-extrabold tracking-tight text-ink">
              FRPB
            </span>
          </a>

          <nav className="hidden items-center gap-5 lg:flex">
            <a
              href="/"
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
            <h2 className="text-lg font-bold text-ink">
              1. Our 7-Day Money-Back Guarantee
            </h2>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <strong className="font-semibold">
                {COMPANY_NAME} offers a 7-Day Money-Back Guarantee.
              </strong>{" "}
              If a plan does not work for you, you may request a full refund of the
              amount you paid within seven (7) days of your purchase, provided the
              conditions below are met.
            </div>
            <p className="mt-3">
              This guarantee applies to purchases made directly through the FRPB
              website or the FRPB checkout. Because FRPB delivers
              digitally-activated software licences instantly, the guarantee is
              structured around the licence-activation state, as set out below.
              Purchases made through third-party app stores or resellers are governed
              by that store’s or reseller’s refund policy, not ours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. 6-Month Plans
            </h2>
            <p>
              For 6-month (one-time) plans:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                You may request a refund within <strong>seven (7) days</strong> of the
                date of purchase if you have not used the plan beyond a brief trial.
              </li>
              <li>
                If your plan is cancelled within the refund window and no
                significant recovery work has been performed, we will refund the amount
                you paid for that term, excluding any taxes we were required to
                collect.
              </li>
              <li>
                Refunds are processed to the original payment method. Depending on your
                bank or payment provider, the refund may appear on your statement within
                a few business days.
              </li>
              <li>
                After the seven-day window, 6-month plans are not eligible for a
                refund. Because 6-month plans are one-time purchases and do not renew,
                no further charges are made when the term ends.
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
              4. Ineligible Refund Scenarios
            </h2>
            <p>
              The following requests are <strong>not</strong> eligible for a refund:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Change of mind after successful activation</strong> — where the
                license key has already been activated on a device.
              </li>
              <li>
                <strong>Requests made after the 7-day window</strong> — any request
                submitted more than seven (7) days after the purchase date.
              </li>
              <li>
                <strong>Expired licences</strong> — a licence whose term has already
                lapsed.
              </li>
              <li>
                <strong>Unauthorized or fraudulent chargebacks</strong> — initiating a
                bank or card chargeback instead of using this process, or any
                fraudulent or abusive refund attempt (for example, repeated refunds for
                the same plan).
              </li>
              <li>
                <strong>Licences purchased outside official frpb.in channels</strong> —
                purchases made through third-party resellers, app stores or
                unauthorised sellers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. Payment Errors and Duplicate Charges
            </h2>
            <p>
              If you were charged more than once for the same purchase, or charged for a
              plan you did not receive, please contact us immediately and we will work to
              correct the error, including issuing a refund where appropriate. These
              cases are handled outside the 7-day guarantee and are always reviewed in
              good faith.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              6. Technical Issues Not Resolved
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
            <h2 className="text-lg font-bold text-ink">
              7. How to Submit a Refund Request
            </h2>
            <p>
              Refund requests may be submitted either through your account dashboard or
              directly by email. To request a refund:
            </p>
            <ol className="mt-3 list-decimal pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Via the Dashboard</strong> — sign in and open the relevant
                licence, or
              </li>
              <li>
                <strong>Via email</strong> — write to{" "}
                <a
                  href={mailtoHref(SUPPORT_EMAIL)}
                  className="text-brand-600 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                with the subject line “Refund Request”.
              </li>
            </ol>
            <p className="mt-3">Please include:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Your FRPB account email address.</li>
              <li>The order ID or payment transaction ID.</li>
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
              8. Licence Deactivation on Refund
            </h2>
            <p>
              Approval of a refund <strong>immediately deactivates the associated
              license key</strong> and any device activations bound to it. Once
              deactivated, the licence can no longer be used to run the Software, and
              the deactivated key may not be reused, reactivated or transferred.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              9. Refund Processing Time
            </h2>
            <p>
              Once a refund is approved, it is typically processed within <strong>five
              (5) to seven (7) business days</strong>. The actual time for the funds to
              appear in your account depends on your bank or payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">10. Changes to This Policy</h2>
            <p>
              We may update this Refund Policy from time to time. If we make a material
              change, we will notify you by email or a notice on our website. The “Last
              updated” date at the top reflects the latest revision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">11. Contact Us</h2>
            <p>
              Questions about refunds or this policy:
            </p>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
              <a
                href={mailtoHref(SUPPORT_EMAIL)}
                className="text-brand-600 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              <a
                href={mailtoHref(LEGAL_EMAIL)}
                className="text-brand-600 hover:underline"
              >
                {LEGAL_EMAIL}
              </a>
              <p>{LEGAL_LOCATION}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
