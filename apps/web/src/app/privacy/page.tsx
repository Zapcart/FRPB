// FRPB — Privacy Policy
// Server component. Static legal page describing what data we collect, how we
// use it, and how long we keep it, written for a lay customer in plain English.

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How FRPB collects, uses and protects your personal data — our privacy policy for the FRPB website and desktop application.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
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
          Privacy Policy
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
            <h2 className="text-lg font-bold text-ink">1. Who we are</h2>
            <p>
              FRPB (“we”, “us” or “our”) operates the FRPB desktop application and
              the frpb.in website from India. We provide a device recovery and utility
              tool for Android and iOS devices. Our tools are intended for authorised
              device owners and technical professionals only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. What data we collect
            </h2>
            <p>
              We collect only the data necessary to operate our service:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Account data</strong> — your email address and a hashed
                identifier when you sign up via Supabase/Auth. We do not store raw
                passwords; authentication is handled by our Auth provider.
              </li>
              <li>
                <strong>Payment data</strong> — when you purchase a plan, we record
                the payment transaction ID, the plan purchased, the currency and the
                amount paid. We do <em>not</em> store full card numbers or bank
                details — those stay with our payment provider (Cashfree).
              </li>
              <li>
                <strong>License data</strong> — the license key issued to you, the
                plan it belongs to, its status (active/expired/revoked), device
                binding information, and activation logs.
              </li>
              <li>
                <strong>Technical logs</strong> — error logs, debug information and
                feature usage metrics that help us improve the app and diagnose
                problems. We do not collect content from your device, your photos,
                messages or files.
              </li>
              <li>
                <strong>Support data</strong> — if you contact us, we keep your email,
                the issue you reported and our replies so we can follow up.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              3. How we use your data
            </h2>
            <p>We use your data only for the following purposes:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Operating and improving the FRPB application — licence verification,
                feature access, usage analytics.</li>
              <li>Processing your payments and managing subscriptions.</li>
              <li>Communicating with you about your account, licence or support request.</li>
              <li>Complying with legal obligations and preventing fraud or abuse.</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal data to third parties. We do
              <strong>not</strong> use your data for unrelated marketing purposes without
              your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. How we share your data
            </h2>
            <p>
              We share your data only with:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Payment provider (Cashfree)</strong> — to process your payment
                and issue refunds. Cashfree handles the actual card/bank data; we only
                receive the transaction result.
              </li>
              <li>
                <strong>Auth provider (Supabase)</strong> — to manage sign-in and
                sessions under our control.
              </li>
              <li>
                <strong>Legal authorities</strong> — if required by law, a court order,
                or to protect the safety of our users or the public.
              </li>
              <li>
                <strong>Service providers</strong> — outsourced processors who help us
                run the business (e.g. email delivery), under data-processing
                agreements that restrict them to using your data only for the task we
                give them.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. How long we keep your data
            </h2>
            <p>
              We keep your data as long as your account or subscription is active, and
              for a reasonable period afterwards to handle refunds, disputes and legal
              records. When a licence expires or a subscription is cancelled, we retain
              the purchase record for at least the period required by applicable tax and
              consumer law. You can ask us to delete your account data at any time (see
              section 8) — subject to any legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              6. Your rights
            </h2>
            <p>Depending on where you live, you may have the right to:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data (subject to legal retention needs).</li>
              <li>Export a copy of your data in a portable format.</li>
              <li>Opt out of non-essential communications from us.</li>
              <li>Lodge a complaint with a data protection authority.</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a
                href="mailto:support@frpb.in"
                className="text-brand-600 hover:underline"
              >
                support@frpb.in
              </a>{" "}
              with “Privacy Request” in the subject line. We will respond within a
              reasonable time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">7. Cookies</h2>
            <p>
              Our website and application use cookies and similar technologies for
              authentication, session management and analytics. You can set your browser
              to refuse cookies, but some parts of the service may not work properly
              without them. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Contact us
            </h2>
            <p>
              Any questions about this Privacy Policy or our data practices:
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

          <section>
            <h2 className="text-lg font-bold text-ink">9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. If we make a material change,
              we will notify you by email or a prominent notice on the website. The
              “Last updated” date at the top will reflect the latest revision.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
