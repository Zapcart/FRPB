// FRPB — Privacy Policy
// Server component. Static legal page describing what data we collect, how we
// use it, how long we keep it, and the GDPR / CCPA rights available to end
// users. Written for a lay customer in plain English.

import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import {
  COMPANY_JURISDICTION,
  DATA_PROCESSORS,
  LEGAL_EMAIL,
  LEGAL_LOCATION,
  LEGAL_WEBSITE,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How FRPB collects, uses, shares and protects your personal data — GDPR and CCPA disclosures for the FRPB website and desktop application.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Last updated:{" "}
          <time dateTime={new Date().toISOString().slice(0, 10)}>
            {new Date().toLocaleDateString("en-US", {
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
              FRPB (“we”, “us” or “our”) is a remote-first, globally distributed
              service that operates the FRPB desktop application and the frpb.in
              website ({COMPANY_JURISDICTION}). We provide a device recovery and
              utility tool for Android and iOS devices. Our tools are intended for
              authorised device owners and technical professionals only.
            </p>
            <p className="mt-3">
              For the purposes of the EU/UK General Data Protection Regulation
              (GDPR) we are the <strong>data controller</strong>; under the
              California Consumer Privacy Act (CCPA/CPRA) we are a{" "}
              <strong>business</strong>; and for users elsewhere — including the
              Middle East, Australia and Canada — we act as the responsible
              controller for the data described in this policy. Our website is{" "}
              {LEGAL_WEBSITE}.
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
                account identifier created when you sign up. Authentication is
                handled by our auth provider ({DATA_PROCESSORS.auth}); we do not
                store raw passwords. We also record your account creation time and
                last login.
              </li>
              <li>
                <strong>Network / security metrics</strong> — a{" "}
                <strong>hashed</strong> (irreversibly one-way) form of your IP
                address and user-agent string, retained purely for fraud
                prevention, rate-limiting and abuse detection. Raw IP addresses are
                not stored, and the hash cannot be used to re-identify you on its own.
              </li>
              <li>
                <strong>Hardware identifiers</strong> — a device fingerprint /
                hardware identifier derived from the device you activate, used to
                bind your licence to a specific device and enforce the per-plan
                device limits. These identifiers are stored only as long as needed
                to operate the licence binding.
              </li>
              <li>
                <strong>Payment data</strong> — when you purchase a plan we record
                the payment transaction ID, order ID, the plan purchased, the
                currency and the amount paid, plus a hashed payment signature used
                to verify the transaction. We do <em>not</em> store full card
                numbers, CVV or bank credentials. Payments are processed by{" "}
                {DATA_PROCESSORS.payments}, which alone receives your card or
                other payment details.
              </li>
              <li>
                <strong>License data</strong> — the license key issued to you, the
                plan it belongs to, its status (active/expired/revoked), device
                binding information, and activation logs.
              </li>
              <li>
                <strong>Technical logs & analytics</strong> — error logs, debug
                information and privacy-preserving product analytics
                ({DATA_PROCESSORS.analytics}) that help us improve the app and
                diagnose problems. We configure analytics to avoid capturing device
                content. We do not collect the content of your device — your photos,
                messages, contacts or files.
              </li>
              <li>
                <strong>Support data</strong> — if you contact us, we keep your
                email, the issue you reported and our replies so we can follow up.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              3. Legal bases for processing (GDPR)
            </h2>
            <p>
              Where the GDPR applies, we process your personal data on the following
              legal bases:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Contract</strong> — to create your account, deliver your
                licence, process payment and provide support (Article 6(1)(b)).
              </li>
              <li>
                <strong>Legitimate interests</strong> — to secure the service, prevent
                fraud and abuse, and keep basic product analytics (Article 6(1)(f)).
              </li>
              <li>
                <strong>Legal obligation</strong> — to keep tax, accounting and
                transaction records (Article 6(1)(c)).
              </li>
              <li>
                <strong>Consent</strong> — for any optional communication you opt
                into, which you may withdraw at any time (Article 6(1)(a)).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. How we use your data
            </h2>
            <p>We use your data only for the following purposes:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Operating and improving the FRPB application — licence
                verification, device binding, feature access, usage analytics.</li>
              <li>Processing your payments and managing subscriptions.</li>
              <li>Communicating with you about your account, licence or support request.</li>
              <li>Complying with legal obligations and preventing fraud or abuse.</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal data, and we do not
              “share” it for cross-context behavioural advertising as those terms are
              defined under the CCPA. We do <strong>not</strong> use your data for
              unrelated marketing purposes without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. Third-party processors and how we share data
            </h2>
            <p>
              We disclose your data only to the following categories of recipients,
              each acting under a data-processing agreement that restricts them to
              processing your data solely on our instructions:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Payments — {DATA_PROCESSORS.payments}</strong>: processes card
                and other online payments, receives your payment instrument details, and
                handles refunds. We receive only the transaction result, order ID and
                payment signature.
              </li>
              <li>
                <strong>Email delivery — {DATA_PROCESSORS.email}</strong>: dispatches
                transactional emails such as your license key and purchase receipt to
                your account email address.
              </li>
              <li>
                <strong>Analytics — {DATA_PROCESSORS.analytics}</strong>: collects
                privacy-preserving product usage analytics to help us understand how
                the app is used. It is not used to build advertising profiles.
              </li>
              <li>
                <strong>Authentication — {DATA_PROCESSORS.auth}</strong>: manages
                sign-in, sessions and account records under our control.
              </li>
              <li>
                <strong>Legal authorities</strong>: where required by law, a court
                order, or to protect the safety of our users or the public.
              </li>
            </ul>
            <p>
              We do not permit our processors to use your personal data for their own
              independent purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              6. Data retention
            </h2>
            <p>
              We keep personal data only as long as necessary for the purposes above:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Account data</strong> — retained while your account is active
                and deleted (or anonymised) within a reasonable period after you
                request closure.
              </li>
              <li>
                <strong>Transaction & payment records</strong> — retained for the
                period required by applicable tax, accounting and consumer-protection
                law (typically up to eight (8) years), even after account deletion.
              </li>
              <li>
                <strong>Licence & activation logs</strong> — retained for the life
                of the licence plus a short dispute-resolution window, then deleted or
                anonymised.
              </li>
              <li>
                <strong>Security metrics (hashed IP / user-agent)</strong> — retained
                for a short rolling window sufficient for fraud and abuse detection,
                then purged.
              </li>
              <li>
                <strong>Support correspondence</strong> — retained for a reasonable
                period so we can resolve and reference past issues.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              7. International and cross-border data transfers
            </h2>
            <p>
              We are a remote-first, globally distributed service, and some of our
              processors (including {DATA_PROCESSORS.payments}, {DATA_PROCESSORS.email},{" "}
              {DATA_PROCESSORS.analytics} and {DATA_PROCESSORS.auth}) may store or
              process data on servers located outside your country, including in the
              United States and the European Union.
            </p>
            <p className="mt-3">
              Where we transfer personal data out of the EEA, the UK or Switzerland,
              we rely on appropriate safeguards such as the European Commission’s
              Standard Contractual Clauses (and the UK Addendum where applicable),
              together with supplementary technical and organisational measures. We
              apply equivalent, jurisdiction-neutral safeguards to transfers from
              other regions. You may contact us for more information about the
              safeguards we use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Your privacy rights
            </h2>
            <p>
              Depending on where you live, you have the following rights. We do not
              discriminate against you for exercising them.
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Access</strong> — request a copy of the personal data we hold
                about you.
              </li>
              <li>
                <strong>Rectification</strong> — correct inaccurate or incomplete data.
              </li>
              <li>
                <strong>Erasure</strong> — request deletion of your personal data,
                subject to legal retention obligations.
              </li>
              <li>
                <strong>Portability</strong> — receive your data in a structured,
                machine-readable (portable) format.
              </li>
              <li>
                <strong>Restriction / objection</strong> — restrict or object to certain
                processing based on legitimate interests.
              </li>
              <li>
                <strong>Opt out</strong> — opt out of non-essential communications at
                any time.
              </li>
              <li>
                <strong>Complaint</strong> — lodge a complaint with your local data
                protection authority.
              </li>
            </ul>
            <p className="mt-3">
              You may also nominate another individual to exercise these rights on
              your behalf where local law permits. We process your data only for the
              lawful purposes stated above.
            </p>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a
                href={mailtoHref(LEGAL_EMAIL)}
                className="text-brand-600 hover:underline"
              >
                {LEGAL_EMAIL}
              </a>{" "}
              with “Privacy Request” in the subject line. We will respond within the
              timeframe required by applicable law (generally within thirty (30) days
              for GDPR and forty-five (45) days for CCPA requests). We may need to
              verify your identity before acting on a request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              9. How we protect your data
            </h2>
            <p>
              We use technical and organisational measures appropriate to the risk,
              including encryption in transit (TLS), hashing of network identifiers,
              access controls, and the principle of least privilege for internal
              access. No system is perfectly secure; if we become aware of a breach
              affecting your personal data, we will notify you and the relevant
              authorities as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              10. Children’s privacy
            </h2>
            <p>
              The FRPB service is not directed to children under the age of 18 (or the
              minimum age of digital consent in your jurisdiction). We do not
              knowingly collect personal data from children. If you believe a child
              has provided us personal data, contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">11. Cookies</h2>
            <p>
              Our website and application use cookies and similar technologies for
              authentication, session management and privacy-preserving analytics. You
              can set your browser to refuse cookies, but some parts of the service may
              not work properly without them. We do not use third-party advertising
              cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              12. Contact us & data protection requests
            </h2>
            <p>
              Any questions about this Privacy Policy or our data practices, or to
              submit a data access, correction or deletion request, contact us at:
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
            <p className="mt-3 text-sm text-slate-500">
              Use the subject line “Data Access Request” for a copy of your data, or
              “Data Deletion Request” to request erasure of your account data. We
              acknowledge requests within a reasonable time and complete them
              subject to any legal retention obligations described in section 6.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">13. Changes to this policy</h2>
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
