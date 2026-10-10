// FRPB — About Us
// Server component. Static informational page describing what FRPB is, who it
// serves and how the company operates. Required for AdSense approval and
// Google Search Console quality/trust signals: it gives the storefront a clear,
// human-readable "who is behind this site" surface linked from the footer.
//
// Copy is deliberately jurisdiction-neutral (remote-first, globally
// distributed) so it reads correctly for a worldwide audience across the US,
// UK, EU, Australia, Canada and the Middle East with no local operational
// trace.

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
  title: "About Us",
  description:
    "About FRPB — a remote-first, globally distributed team building a one-click Android FRP bypass and device recovery utility for authorised device owners and certified repair technicians worldwide.",
  path: "/about",
});

export default function AboutPage() {
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
              href="/contact"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Contact Us
            </a>
          </nav>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Company
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          About FRPB
        </h1>

        <div className="mt-8 max-w-2xl text-base leading-relaxed text-slate-700 space-y-8">
          <section>
            <h2 className="text-lg font-bold text-ink">1. Who We Are</h2>
            <p className="mt-3">
              {COMPANY_NAME} is a remote-first, globally distributed software
              company. We build a focused, one-click device recovery utility that
              helps authorised device owners and certified repair technicians
              regain access to devices they lawfully own or service. We operate
              no country-specific office; our team and our customer base span the
              United States, the United Kingdom, the European Union, Australia,
              Canada, the Middle East and beyond.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. What FRPB Does
            </h2>
            <p className="mt-3">
              FRPB is a desktop recovery tool that automates common, time-consuming
              device-recovery workflows so that technicians and owners do not have
              to fight through fragmented, model-specific utilities. From a single
              guided interface it handles Android FRP (Factory Reset Protection)
              bypass, screen-lock and passcode removal, FRP-enabled resets, and
              general device-recovery tasks across a broad matrix of OEM brands and
              models.
            </p>
            <p className="mt-3">
              The tool is designed to be fast, predictable and safe for the device:
              it favours non-destructive methods wherever possible and clearly
              documents when a procedure will reset data. FRPB is intended strictly
              for devices that the operator owns or has explicit, written
              authorisation to service — it is not a tool for accessing devices
              without permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">3. Who We Serve</h2>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Certified repair technicians</strong> who process trade-ins
                and refurbishments at volume and need a repeatable, fast path
                through FRP and lock-screen recovery.
              </li>
              <li>
                <strong>IT and device-fleet administrators</strong> who manage
                pools of Android devices and need to reconcile or re-provision owned
                hardware.
              </li>
              <li>
                <strong>Individual device owners</strong> who have legitimately
                locked themselves out of their own hardware after a factory reset
                and want a straightforward, documented way back in.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">4. Our Principles</h2>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Legitimate use first.</strong> Every page, tool and policy on
                this site is built around authorised ownership and professional
                repair — never unauthorised access.
              </li>
              <li>
                <strong>Transparency.</strong> We name our payment, email,
                analytics and authentication processors, publish clear privacy,
                terms, refund and licence policies, and date every legal document
                so it is obvious when it last changed.
              </li>
              <li>
                <strong>Global by default.</strong> Prices, policies and support are
                presented in US Dollars with jurisdiction-neutral language so the
                product works the same way wherever our customers are.
              </li>
              <li>
                <strong>Support that answers.</strong> Paid plans include direct
                human support from the people who build the tool.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. How We Operate
            </h2>
            <p className="mt-3">
              {COMPANY_NAME} operates as {COMPANY_ENTITY} ({COMPANY_ADDRESS}) and
              serves customers {LEGAL_LOCATION.toLowerCase()}. Software is
              delivered digitally and activated through your account, so there is
              nothing to ship and no physical distribution to wait on. Billing,
              licensing and account management all flow through this website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">6. Get in Touch</h2>
            <p className="mt-3">
              Questions about the product, licensing or partnerships are welcome.
              Reach our team at{" "}
              <a
                href={mailtoHref(SUPPORT_EMAIL)}
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              or visit our{" "}
              <a
                href="/contact"
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                Contact page
              </a>
              . Privacy and data-rights requests can be directed to{" "}
              <a
                href={mailtoHref(LEGAL_EMAIL)}
                className="font-medium text-brand-600 underline underline-offset-2"
              >
                {LEGAL_EMAIL}
              </a>
              .
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
          <a href="/contact" className="transition hover:text-slate-900">
            Contact
          </a>
        </nav>
      </main>
    </div>
  );
}
