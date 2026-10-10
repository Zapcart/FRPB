// FRPB — Contact Us
// Server component. Static contact page surfacing the global support and legal
// mailboxes, the service area and the operator identity. Required for AdSense
// approval and Search Console quality/trust signals: it gives users a clear,
// working way to reach the site owner.
//
// Copy is jurisdiction-neutral (remote-first, globally distributed) and uses
// USD / worldwide framing so it reads correctly for a global audience with no
// local operational trace.

import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import {
  COMPANY_ADDRESS,
  COMPANY_ENTITY,
  COMPANY_NAME,
  LEGAL_EMAIL,
  LEGAL_LOCATION,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Contact FRPB — reach our global support and legal teams for help with licensing, billing, account access, privacy requests or product questions. Remote-first, serving customers worldwide.",
  path: "/contact",
});

export default function ContactPage() {
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
            <a
              href="/about"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              About Us
            </a>
          </nav>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Support
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Contact Us
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          {COMPANY_NAME} is a remote-first, globally distributed service, so the
          fastest way to reach us is by email. Our team reads every message and
          aims to reply within one business day. We support customers{" "}
          {LEGAL_LOCATION.toLowerCase()}.
        </p>

        {/* ===== CONTACT CARDS ===== */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href={mailtoHref(SUPPORT_EMAIL)}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Customer Support
            </p>
            <p className="mt-2 text-lg font-bold text-ink group-hover:text-brand-600">
              {SUPPORT_EMAIL}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Account access, licensing, billing, installation and general product
              questions.
            </p>
          </a>

          <a
            href={mailtoHref(LEGAL_EMAIL)}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Legal & Privacy
            </p>
            <p className="mt-2 text-lg font-bold text-ink group-hover:text-brand-600">
              {LEGAL_EMAIL}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              GDPR / CCPA / UK-GDPR data-access and erasure requests, legal notices
              and compliance queries.
            </p>
          </a>
        </div>

        <div className="mt-10 max-w-2xl text-base leading-relaxed text-slate-700 space-y-8">
          <section>
            <h2 className="text-lg font-bold text-ink">
              1. Before You Write
            </h2>
            <p className="mt-3">
              To help us resolve your query on the first reply, please include the
              email address on your FRPB account, your order or licence reference
              (if relevant), and a short description of what you need. If you are
              reporting a technical issue, your operating system and the exact
              error or device model help us enormously.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. Refunds and Billing
            </h2>
            <p className="mt-3">
              Refund requests are handled under our{" "}
              <a
                href="/refund"
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                Refund Policy
              </a>
              . Email the support address above from your account email with your
              order reference and we will process eligible requests within the
              published window. Payments on this site are processed in US Dollars
              (USD) by our payment provider on checkout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              3. Data Requests
            </h2>
            <p className="mt-3">
              To exercise a data-access, correction, deletion or portability right
              under the GDPR, UK-GDPR or CCPA, email our legal address. We may ask
              you to verify your identity so we do not disclose account data to the
              wrong person. See our{" "}
              <a
                href="/privacy"
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                Privacy Policy
              </a>{" "}
              for full details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. Operator Details
            </h2>
            <p className="mt-3">
              {COMPANY_NAME} operates as {COMPANY_ENTITY} ({COMPANY_ADDRESS}).
              Service area: {LEGAL_LOCATION}. You can read more about the team and
              the product on our{" "}
              <a
                href="/about"
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                About Us
              </a>{" "}
              page.
            </p>
          </section>
        </div>

        {/* ===== LEGAL NAV ===== */}
        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <a href="/terms" className="transition hover:text-slate-900">
            Terms of Service
          </a>
          <a href="/privacy" className="transition hover:text-slate-900">
            Privacy Policy
          </a>
          <a href="/eula" className="transition hover:text-slate-900">
            EULA
          </a>
          <a href="/refund" className="transition hover:text-slate-900">
            Refund Policy
          </a>
          <a href="/about" className="transition hover:text-slate-900">
            About Us
          </a>
        </nav>
      </main>
    </div>
  );
}
