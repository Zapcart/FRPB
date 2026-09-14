// FRPB — Terms of Service
// Server component. Static legal page covering account terms, acceptable use,
// payment terms, license terms, prohibited uses, liability limits and dispute
// resolution for the FRPB website and desktop application.

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "Terms of Service for FRPB — account terms, payment terms, license terms, acceptable use and liability limits.",
  path: "/terms",
});

export default function TermsOfServicePage() {
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
          Terms of Service
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
            <h2 className="text-lg font-bold text-ink">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the FRPB website at frpb.in, and the FRPB desktop
              application (“the Software”, “we”, “us” or “our”), you agree to be bound
              by these Terms of Service (“Terms”). If you do not agree to these Terms,
              you must not access or use the website or the Software.
            </p>
            <p>
              These Terms work together with our End User License Agreement (“EULA”) and
              Refund Policy. Where these documents overlap, the more specific provision
              applies. If you have purchased a plan, the plan terms and this Agreement
              together govern your use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">2. Description of Service</h2>
            <p>
              FRPB provides a desktop device recovery and utility application for Android
              and iOS, together with a website for purchasing plans, managing your
              account, obtaining license keys and accessing documentation and support.
            </p>
            <p>
              The Software includes tools for driver installation, device monitoring,
              guided recovery procedures, and device reset, recovery and unlock
              operations for devices you are authorised to service. The Software is
              intended for legitimate device maintenance and recovery by device owners,
              authorised technicians and service shops.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              3. Eligibility
            </h2>
            <p>
              You must be at least the age required to enter into a binding contract in
              your country of residence (generally 18 years) to purchase a plan or use
              the paid features of the Software. You represent and warrant that you are
              authorised to agree to these Terms on behalf of yourself or, if you are
              using the Software for business purposes, on behalf of your organisation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">4. Account</h2>
            <p>
              To access paid features you must create an FRPB account through our
              authentication provider. You are responsible for:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Keeping your login credentials confidential.</li>
              <li>All activity under your account, whether or not you authorised it.</li>
              <li>Notifying us promptly if you suspect unauthorised access to your
                account.</li>
              <li>Providing accurate and current information, including your email
                address.</li>
            </ul>
            <p>
              You may not create more than one account to circumvent plan limits, and you
              may not transfer your account to another person. We reserve the right to
              suspend or terminate accounts that violate these Terms or are used for
              fraudulent purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">5. Plans and Payments</h2>
            <p>
              Plans are offered on a monthly, yearly or lifetime basis as described on
              our pricing page and in your order confirmation:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Monthly and yearly plans</strong> are subscriptions that renew
                automatically at the end of each billing period unless you cancel before
                the renewal date. You may cancel at any time; cancellation stops future
                renewals but does not refund fees already paid, except where required by
                law or our Refund Policy.
              </li>
              <li>
                <strong>Lifetime plans</strong> are one-time purchases that grant
                perpetual access under the device limits of the plan, subject to these
                Terms and our EULA.
              </li>
            </ul>
            <p>
              All amounts are stated in the currency you select at checkout. We use a
              payment provider to process payments; you authorise us to charge the payment
              method you provide. Fees are non-refundable except as provided in our Refund
              Policy. If your payment fails, we may suspend access until payment is
              successfully completed.
            </p>
            <p>
              We do not provide refunds or credits for partial use of a subscription
              period, except where a refund is required by law or our Refund Policy
              applies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              6. Licenses
            </h2>
            <p>
              When you purchase a plan, you receive a license key that activates the paid
              features of the Software. The scope and limits of each license are governed
              by the plan you purchased, our EULA and these Terms. License keys are
              personal to the account that purchased them and are not transferable, sellable
              or shareable with another person or account.
            </p>
            <p>
              Each license may be activated on the number of devices permitted by your
              plan. If you need to replace a device or re-activate a device, contact
              support for assistance within the limits of your plan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              7. Acceptable Use
            </h2>
            <p>
              You agree to use the website and the Software only for lawful purposes and
              in a way that does not infringe the rights of others or restrict or inhibit
              anyone else’s use and enjoyment of the website or the Software. You must
              have the legal right to access and service any device on which you use the
              Software.
            </p>
            <p>
              In particular, you may only use the Software’s recovery, reset and unlock
              features on devices you own or are authorised by the owner to service, and
              only in compliance with applicable laws, the device manufacturer’s terms,
              and the rights of any person or organisation that owns the device or the
              data on it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Prohibited Conduct
            </h2>
            <p>You may <strong>not</strong>:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Use the Software or website to bypass, circumvent or remove security
                protections — including FRP, activation locks, passcodes, encryption,
                bootloader locks or any other protection — on a device you do not own or
                are not authorised to service.</li>
              <li>Use the Software or website in violation of any applicable law,
                regulation, manufacturer terms or third-party rights.</li>
              <li>Attempt to reverse engineer, decompile, disassemble, modify, sublicense
                or create derivative works of the Software, except to the extent expressly
                permitted by law.</li>
              <li>Distribute the Software or license keys to third parties, or resell them
                without our written consent.</li>
              <li>Remove, alter or obscure any copyright, trademark or proprietary notice
                on the Software or the website.</li>
              <li>Use the Software or website to access, copy, distribute or exploit
                content on a device you are not authorised to access.</li>
              <li>Interfere with, disrupt, or attempt to interfere with the operation of
                the website, the Software, or our servers.</li>
              <li>Use the website or the Software to send unsolicited communications, spam,
                malware, or any content that is unlawful, harmful, threatening, abusive
                or harassing.</li>
              <li>Circumvent the rate limits, access controls, or security measures we have
                put in place.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              9. User Content and Data Responsibility
            </h2>
            <p>
              The Software and our tools may interact with devices and may perform
              operations that can affect the data, operating system or state of a device.
              You are solely responsible for:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Ensuring you have authorised access to each device you service.</li>
              <li>Deciding whether to back up any important data before using recovery,
                reset or unlock operations.</li>
              <li>Any loss of data, photos, messages, accounts, settings or other content
                that results from your use of the Software.</li>
              <li>Ensuring that any device reset, recovery or unlock complies with
                applicable laws and the rights of the device owner.</li>
            </ul>
            <p>
              We do not guarantee that any device will be recoverable, bootable, or
              usable after using the Software. Device recovery, reset and unlock
              operations inherently carry risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">9. Third-Party Services</h2>
            <p>
              Our website and the Software may link to or integrate third-party services,
              including payment providers, authentication providers and documentation
              resources. Your use of those services is subject to their own terms and
              privacy policies. We are not responsible for the availability, security or
              content of third-party services.
            </p>
            <p>
              We use a payment provider (Cashfree) to process payments. Card and bank
              details are handled by the payment provider, not by us. Payment processing
              may be subject to foreign exchange rates and transaction fees imposed by the
              payment provider or your bank, which may affect the final amount charged.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">10. Changes to the Service</h2>
            <p>
              We may update, modify or discontinue the website or the Software at any time,
              with or without notice. We may add new features, remove features, change
              device support, or adjust plan terms. We will make reasonable efforts to
              notify you of material changes that affect your use.
            </p>
            <p>
              We do not guarantee that the Software will be error-free, uninterrupted or
              free of viruses or other harmful code. Device recovery results depend on the
              specific device, its condition, and the procedure used; outcomes vary.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              11. Disclaimers
            </h2>
            <p>
              EXCEPT AS EXPRESSLY SET OUT IN THESE TERMS OR IN OUR EULA, THE WEBSITE AND
              THE SOFTWARE ARE PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SOFTWARE WILL MEET YOUR
              REQUIREMENTS, THAT IT WILL BE UNINTERRUPTED OR SECURE, OR THAT DEFECTS WILL
              BE CORRECTED.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              12. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER FRPB NOR ITS
              OFFICERS, EMPLOYEES, AGENTS OR LICENSORS WILL BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR ANY
              LOSS OF PROFITS, REVENUE, DATA, USE, GOODWILL OR OTHER INTANGIBLE LOSS,
              ARISING OUT OF OR RELATING TO THE WEBSITE, THE SOFTWARE, THESE TERMS OR ANY
              COURSE OF DEALING, EVEN IF FRPB HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
              DAMAGES.
            </p>
            <p>
              FRPB’S AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING
              TO THESE TERMS OR THE WEBSITE OR THE SOFTWARE WILL NOT EXCEED THE AMOUNT YOU
              PAID TO FRPB IN THE TWELVE (12) MONTHS IMMEDIATELY BEFORE THE EVENT GIVING
              RISE TO THE CLAIM, OR USD 100 IF YOU HAVE PAID NO FEES. THESE LIMITATIONS
              APPLY ONLY TO THE EXTENT NOT PROHIBITED BY LAW.
            </p>
            <p>
              Nothing in these Terms limits liability for fraud, wilful misconduct, or any
              liability that cannot be excluded or limited by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">13. Indemnification</h2>
            <p>
              You agree to defend, indemnify and hold harmless FRPB and its officers,
              employees, agents and affiliates from and against any third-party claims,
              damages, losses, liabilities and expenses (including reasonable legal fees)
              arising out of or relating to your breach of these Terms, your use of the
              Software or the website in violation of applicable law, or your violation of
              any third party’s rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              14. Suspension and Termination
            </h2>
            <p>
              We may suspend or terminate your access to the website or the Software, in
              whole or in part, if:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>You breach these Terms and do not cure the breach after notice.</li>
              <li>You engage in fraud, abuse, or use the Software or website in violation
                of applicable law.</li>
              <li>We are required to do so by law, a court order, or to protect the safety
                of our users or the public.</li>
              <li>We discontinue the Software or a plan, subject to any prepaid,
                non-refundable fees as required by law or our Refund Policy.</li>
            </ul>
            <p>
              On termination, you must stop using the Software and website. Provisions that
              by their nature should survive termination — including ownership,
              disclaimers, liability limits, indemnification, governing law and dispute
              resolution — remain in effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              15. Governing Law and Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of India, without regard to its conflict
              of laws principles. Any dispute arising out of or relating to these Terms or
              the website or the Software that cannot be resolved amicably shall be subject
              to the exclusive jurisdiction of the courts located in India, unless mandatory
              law provides otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">16. General Provisions</h2>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Severability.</strong> If any part of these Terms is held invalid or
                unenforceable, the rest remain in full force and effect.
              </li>
              <li>
                <strong>Waiver.</strong> Our failure to enforce any right under these Terms
                does not waive that right.
              </li>
              <li>
                <strong>Assignment.</strong> You may not assign these Terms without our
                consent. We may assign these Terms in connection with a merger, acquisition
                or sale of assets.
              </li>
              <li>
                <strong>Entire Agreement.</strong> These Terms, together with our EULA,
                Refund Policy, Privacy Policy and any applicable plan or order terms,
                constitute the entire agreement between you and FRPB and supersede all
                prior or contemporaneous communications.
              </li>
              <li>
                <strong>Amendments.</strong> We may amend these Terms by posting the amended
                version on our website with an updated “Last updated” date. Your continued
                use after the effective date constitutes acceptance.
              </li>
              <li>
                <strong>Notices.</strong> Notices to us should be sent to{" "}
                <a
                  href="mailto:support@frpb.in"
                  className="text-brand-600 hover:underline"
                >
                  support@frpb.in
                </a>
                .
              </li>
              <li>
                <strong>Force Majeure.</strong> We are not liable for delays or failures to
                perform caused by events beyond our reasonable control, including
                network outages, acts of government, disasters, or failures of third-party
                services we rely on.
              </li>
              <li>
                <strong>Contact.</strong> Any questions about these Terms should be sent to{" "}
                <a
                  href="mailto:support@frpb.in"
                  className="text-brand-600 hover:underline"
                >
                  support@frpb.in
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
