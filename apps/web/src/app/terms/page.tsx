// FRPB — Terms of Service
// Server component. Static legal page governing use of the FRPB website and
// desktop application: account, payment, license grant, restrictions, warranty
// disclaimers, liability cap, termination, and governing law / dispute
// resolution. Jurisdiction-neutral for a worldwide audience.
// Not legal advice — have a qualified lawyer review before relying on it.

import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import {
  COMPANY_JURISDICTION,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "Terms of Service for FRPB — account terms, payment and license terms, usage restrictions, warranty disclaimers, liability limits and governing law.",
  path: "/terms",
});

export default function TermsOfServicePage() {
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
          Terms of Service
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
            <h2 className="text-lg font-bold text-ink">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service (“Terms”) form a legally binding agreement
              between you (“you”, “your”) and FRPB (“FRPB”, “we”, “us”, “our”)
              governing your access to and use of the FRPB website at frpb.in,
              the FRPB desktop application, and any related services
              (collectively, the “Service”). By creating an account, purchasing a
              plan, downloading, installing or using the Service, you confirm
              that you have read, understood and agree to be bound by these Terms
              and our{" "}
              <a href="/eula" className="text-brand-600 hover:underline">
                End User License Agreement
              </a>
              ,{" "}
              <a href="/privacy" className="text-brand-600 hover:underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/refund" className="text-brand-600 hover:underline">
                Refund Policy
              </a>
              . If you do not agree, you must not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. Description of Service
            </h2>
            <p>
              FRPB is a desktop software utility for mobile-device recovery,
              diagnostics, firmware management and repair workflows, together
              with a website that provides account management, licence delivery
              and documentation. The Service is intended for device owners and
              professional repair technicians who are legally authorised to
              service the devices on which they use it.
            </p>
            <p>
              Device recovery results depend on the specific device, its
              condition, firmware and the procedure used. We do not guarantee
              that any device will be recoverable, bootable or usable after using
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and have the legal capacity to
              enter into a binding contract to use the Service. Where you use the
              Service on behalf of a business, you represent that you are
              authorised to bind that business to these Terms. The Service is not
              intended for use where such use would be prohibited by applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. Account Registration and Security
            </h2>
            <p>
              To purchase or access paid features you must create an account
              using a valid email address. You agree to:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Provide accurate, current and complete information.</li>
              <li>
                Keep your login credentials confidential and not share your
                account with any other person.
              </li>
              <li>
                Notify us promptly at{" "}
                <a
                  href={mailtoHref(SUPPORT_EMAIL)}
                  className="text-brand-600 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                of any unauthorised use of your account.
              </li>
            </ul>
            <p>
              You may not create more than one account to circumvent plan or
              device limits, and you may not transfer your account to another
              person. We may suspend or terminate accounts that violate these
              Terms or are used for fraudulent purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. Plans, Pricing and Payments
            </h2>
            <p>
              Plans are offered as a 6-month plan or a lifetime plan as described
              on our pricing page and in your order confirmation:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>6-Month Plan</strong> — a one-time purchase that grants
                access for one hundred and eighty (180) days from the date of
                purchase and permits activation on <strong>one (1) device</strong>. It
                does not renew automatically; when the term ends you may purchase a
                new plan to continue using the Software.
              </li>
              <li>
                <strong>Lifetime Plan</strong> — a one-time purchase that grants
                perpetual access under the device limits of the plan, permitting
                activation on up to <strong>five (5) devices</strong>, subject to
                these Terms and our EULA.
              </li>
            </ul>
            <p>
              All amounts are stated in United States Dollars (USD), the primary
              currency for the Service. Payments are processed by our payment
              gateway; you authorise us and our processor to charge the payment
              method you provide. Prices are inclusive of applicable taxes unless
              stated otherwise. Fees are non-refundable except as provided in our{" "}
              <a href="/refund" className="text-brand-600 hover:underline">
                Refund Policy
              </a>
              . If your payment fails, we may suspend access until payment is
              successfully completed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">6. License Grant</h2>
            <p>
              Subject to your compliance with these Terms, the EULA and payment of
              the applicable fees, FRPB grants you a limited,{" "}
              <strong>
                non-exclusive, non-transferable, non-sublicensable and revocable
              </strong>{" "}
              licence to install and use the Software for your own personal or
              professional device-recovery purposes, strictly within the device
              and duration limits of the plan you purchased. The Software is{" "}
              <strong>licensed, not sold</strong>; no ownership or title is
              transferred to you.
            </p>
            <p>
              You may install the Software on any number of computers that you
              control, but you may activate and use it only on the number of
              devices permitted by your plan at any one time. A device is counted
              once it has been activated under your account. If you need to
              replace or re-activate a device, contact support within the limits
              of your plan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              7. License Restrictions
            </h2>
            <p>
              Except to the extent expressly permitted by applicable law, you may{" "}
              <strong>not</strong>:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                Reverse engineer, decompile, disassemble, translate or otherwise
                attempt to derive the source code, algorithms or underlying
                structure of the Software.
              </li>
              <li>
                Modify, adapt, create derivative works of, or merge the Software
                with any other software.
              </li>
              <li>
                Redistribute, publish, upload, share or make the Software
                available to any third party, whether for free or for
                consideration.
              </li>
              <li>
                Rent, lease, sublicense, sell, resell, or commercially exploit the
                Software or any licence key, or use it as part of a service bureau
                for third parties without our prior written consent.
              </li>
              <li>
                Remove, alter or obscure any copyright, trademark, licence or
                other proprietary notice on the Software or its documentation.
              </li>
              <li>
                Circumvent, disable or interfere with any licence-enforcement,
                activation, authentication or security mechanism.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">8. Acceptable Use</h2>
            <p>
              You agree to use the Service only for lawful purposes and in a way
              that does not infringe the rights of, or restrict the use and
              enjoyment of the Service by, any other person. You must have the
              legal right to access and service every device on which you use the
              Software.
            </p>
            <p>
              In particular, you may only use the recovery, reset and unlock
              features on devices you own or are expressly authorised by the owner
              to service, and only in compliance with applicable laws, the device
              manufacturer’s terms, and the rights of any person or organisation
              that owns the device or the data on it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">9. Prohibited Conduct</h2>
            <p>
              You may <strong>not</strong>:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                Use the Service to bypass, circumvent or remove security
                protections — including FRP, activation locks, passcodes,
                encryption or bootloader locks — on a device you do not own or are
                not authorised to service.
              </li>
              <li>Use the Service in violation of any law or third-party rights.</li>
              <li>
                Distribute the Software or licence keys to third parties, or
                resell them without our prior written consent.
              </li>
              <li>Interfere with, disrupt or attempt to gain unauthorised access to our systems or servers.</li>
              <li>
                Circumvent rate limits, access controls or other security measures
                we put in place.
              </li>
              <li>
                Use the Service to transmit spam, malware, or any unlawful,
                harmful, threatening, abusive or harassing content.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              10. User Responsibility and Device Data
            </h2>
            <p>
              The Service may perform operations that alter, reset or erase data
              on a device. You are solely responsible for:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Ensuring you have authorised access to each device you service.</li>
              <li>
                Backing up any important data before performing recovery, reset or
                unlock operations.
              </li>
              <li>
                Any loss of data, photos, messages, accounts, settings or other
                content resulting from your use of the Service.
              </li>
              <li>
                Ensuring each operation complies with applicable law and the
                rights of the device owner.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              11. Third-Party Services
            </h2>
            <p>
              The Service relies on or links to third-party services, including a
              payment gateway, an authentication provider, an email-delivery
              service and documentation resources. Your use of those services is
              governed by their own terms and privacy policies. We are not
              responsible for the availability, security or content of
              third-party services.
            </p>
            <p>
              Card and other online payments are handled by our payment gateway
              using PCI-DSS compliant infrastructure; we do not store full payment
              instrument details. Payment amounts may be subject to foreign
              exchange rates and transaction fees imposed by the gateway or your
              bank, which may affect the final amount charged.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              12. Changes to the Service
            </h2>
            <p>
              We may update, modify or discontinue the website or the Software at
              any time, with or without notice. We may add or remove features,
              change device support, or adjust plan terms. We will make reasonable
              efforts to notify you of material changes that affect your use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              13. Disclaimer of Warranties
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS
              PROVIDED ON AN <strong>“AS IS”</strong> AND{" "}
              <strong>“AS AVAILABLE”</strong> BASIS, WITHOUT WARRANTIES OF ANY
              KIND, WHETHER EXPRESS, IMPLIED OR STATUTORY, INCLUDING ANY IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              TITLE, ACCURACY AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
              SERVICE WILL BE UNINTERRUPTED, TIMELY, ERROR-FREE, SECURE OR FREE OF
              HARMFUL COMPONENTS, OR THAT IT WILL MEET YOUR REQUIREMENTS OR
              PRODUCE ANY PARTICULAR RECOVERY RESULT.
            </p>
            <p>
              No advice or information obtained from FRPB, whether oral or
              written, creates any warranty not expressly stated in these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              14. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER FRPB NOR
              ITS OFFICERS, EMPLOYEES, AGENTS OR LICENSORS WILL BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE
              DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, USE, GOODWILL OR
              OTHER INTANGIBLE LOSS, ARISING OUT OF OR RELATING TO THE SERVICE,
              THESE TERMS OR ANY COURSE OF DEALING, EVEN IF FRPB HAS BEEN ADVISED
              OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              FRPB’S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF
              OR RELATING TO THESE TERMS OR THE SERVICE IS{" "}
              <strong>
                LIMITED STRICTLY TO THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO FRPB
                FOR THE LICENCE GIVING RISE TO THE CLAIM
              </strong>{" "}
              during the twelve (12) months immediately preceding the event giving
              rise to the claim. If you have paid no fees, FRPB’s total liability
              shall not exceed one hundred United States Dollars (USD 100).
            </p>
            <p>
              Nothing in these Terms limits liability for fraud, wilful
              misconduct, death or personal injury caused by negligence, or any
              other liability that cannot be excluded or limited by applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">15. Indemnification</h2>
            <p>
              You agree to defend, indemnify and hold harmless FRPB and its
              officers, employees, agents and affiliates from and against any
              third-party claims, damages, losses, liabilities and expenses
              (including reasonable legal fees) arising out of or relating to your
              breach of these Terms, your use of the Service in violation of
              applicable law, or your violation of any third party’s rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              16. Suspension and Termination
            </h2>
            <p>
              We may suspend or terminate your access to the Service, in whole or
              in part, if:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>You breach these Terms and do not cure the breach after notice.</li>
              <li>
                You engage in fraud, abuse, or use the Service in violation of
                applicable law.
              </li>
              <li>
                We are required to do so by law, a court order, or to protect the
                safety of our users or the public.
              </li>
              <li>
                We discontinue the Service or a plan, subject to any prepaid,
                non-refundable fees as required by law or our Refund Policy.
              </li>
            </ul>
            <p>
              You may stop using the Service at any time. On termination you must
              stop using the Software and uninstall it from all computers.
              Provisions that by their nature should survive termination —
              including ownership, licence restrictions, disclaimers, liability
              limits, indemnification, governing law and dispute resolution —
              remain in effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              17. Governing Law and Dispute Resolution
            </h2>
            <p>
              These Terms and any dispute or claim arising out of or in connection
              with them are governed by and construed in accordance with
              internationally recognised commercial law principles, without regard
              to conflict-of-laws rules, and the United Nations Convention on
              Contracts for the International Sale of Goods shall not apply.
              Nothing in this section deprives you of the protection of any
              mandatory consumer-protection rules of your country of residence.
            </p>
            <p>
              <strong>Dispute resolution.</strong> If a dispute arises, you and
              FRPB agree to first attempt to resolve it amicably by contacting us
              at{" "}
              <a
                href={mailtoHref(LEGAL_EMAIL)}
                className="text-brand-600 hover:underline"
              >
                {LEGAL_EMAIL}
              </a>{" "}
              and negotiating in good faith for a period of thirty (30) days. If
              the dispute is not resolved within that period, it shall be referred
              to and finally resolved by binding arbitration administered under
              internationally recognised arbitral rules, before a sole arbitrator
              appointed by mutual agreement, and the language of the arbitration
              shall be English. Where mandatory consumer law applies, you may also
              bring proceedings before the competent courts of your country of
              residence.
            </p>
            <p>
              Subject to the arbitration clause above, any matter not subject to
              arbitration shall be handled by a court of competent jurisdiction,
              unless mandatory consumer law provides otherwise. Nothing in this
              section prevents either party from seeking urgent interim or
              injunctive relief from a competent court.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">18. General Provisions</h2>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Severability.</strong> If any part of these Terms is held
                invalid or unenforceable, the rest remain in full force and
                effect.
              </li>
              <li>
                <strong>Waiver.</strong> Our failure to enforce any right under
                these Terms does not waive that right.
              </li>
              <li>
                <strong>Assignment.</strong> You may not assign these Terms without
                our consent. We may assign these Terms in connection with a
                merger, acquisition or sale of assets.
              </li>
              <li>
                <strong>Entire Agreement.</strong> These Terms, together with our
                EULA, Privacy Policy, Refund Policy and any applicable plan or
                order terms, constitute the entire agreement between you and FRPB
                and supersede all prior or contemporaneous communications.
              </li>
              <li>
                <strong>Amendments.</strong> We may amend these Terms by posting
                the amended version on our website with an updated “Last updated”
                date. Your continued use after the effective date constitutes
                acceptance.
              </li>
              <li>
                <strong>Force Majeure.</strong> We are not liable for delays or
                failures to perform caused by events beyond our reasonable
                control, including network outages, acts of government, disasters,
                or failures of third-party services we rely on.
              </li>
              <li>
                <strong>Contact.</strong> Questions about these Terms may be sent
                to{" "}
                <a
                  href={mailtoHref(SUPPORT_EMAIL)}
                  className="text-brand-600 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                or, for legal matters,{" "}
                <a
                  href={mailtoHref(LEGAL_EMAIL)}
                  className="text-brand-600 hover:underline"
                >
                  {LEGAL_EMAIL}
                </a>
                .
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
