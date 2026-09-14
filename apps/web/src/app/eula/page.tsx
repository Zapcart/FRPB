// FRPB — End User License Agreement (EULA)
// Server component. Static legal page governing how a user may use FRPB.
// Not legal advice — have a qualified lawyer review before publishing if you
// need a binding agreement in your jurisdiction.

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "End User License Agreement",
  description:
    "End User License Agreement for FRPB — the terms governing use of the FRPB desktop application, license scope and authorised device use.",
  path: "/eula",
});

export default function EULAPage() {
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
          End User License Agreement
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
            <h2 className="text-lg font-bold text-ink">1. Acceptance</h2>
            <p>
              By installing, copying, accessing or using FRPB (“the Software”), you
              agree to be bound by this End User License Agreement (“Agreement”). If
              you do not agree, do not install or use the Software.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">2. License Grant</h2>
            <p>
              Subject to your compliance with this Agreement, FRPB grants you a
              limited, non-exclusive, non-transferable, revocable licence to use the
              Software for your personal or professional device recovery needs. The
              scope of your use is governed by the plan you have purchased:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>A monthly or yearly plan permits use on the number of devices
                permitted by that plan at any one time.</li>
              <li>A lifetime plan permits perpetual use under the same device limits,
                subject to the restrictions below.</li>
            </ul>
            <p>
              You may install the Software on any number of computers, but you may
              activate and use it only on the devices covered by your licence. A device
              is counted once it has been activated under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">3. Ownership</h2>
            <p>
              The Software, including all copies, modifications and derivative works,
              remains the property of FRPB or its licensors. This Agreement grants you
              a right to use the Software — it does <em>not</em> transfer ownership.
              All rights not expressly granted are reserved.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. Permitted Use
            </h2>
            <p>
              You may use the Software only to:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Recover, repair, reset or manage devices that you own or are
                authorised in writing to service.</li>
              <li>Perform legitimate device maintenance, diagnostics, driver
                installation and firmware recovery.</li>
              <li>Test the Software during the trial or evaluation period if one is
                offered.</li>
            </ul>
            <p>
              You are responsible for ensuring that any device recovery, reset or
              unlock operation complies with applicable laws, the device manufacturer’s
              terms, and the rights of any person or organisation that owns the device
              or the data on it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              5. Restrictions — What You May Not Do
            </h2>
            <p>You may <strong>not</strong>:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Use the Software to bypass, circumvent or remove security protections,
                locks, FRP, activation locks, passcodes, encryption or any other
                protection on a device you do not own or are not authorised to service.</li>
              <li>Reverse engineer, decompile, disassemble, modify, translate, create
                derivative works of, or attempt to derive the source code of the
                Software, except to the extent this is expressly permitted by law.</li>
              <li>Rent, lease, sublicense, sell, distribute, loan, share or otherwise
                provide the Software to any third party, except that you may install it
                on your own computers for your own use.</li>
              <li>Remove, alter or obscure any copyright, trademark or proprietary
                notice on the Software or its documentation.</li>
              <li>Use the Software in a manner that violates any law, regulation,
                manufacturer terms, or the rights of any third party.</li>
              <li>Use the Software to access, copy, distribute or exploit content stored
                on a device that is not yours, without the owner’s lawful consent.</li>
              <li>Use the Software to develop, assist in, or automate any activity that
                circumvents device security on devices you are not authorised to
                service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              6. Backups and Device Content
            </h2>
            <p>
              The Software may perform operations that can alter, reset or erase data on
              a device. FRPB recommends — but cannot force — you to back up any
              important data before using recovery, reset or unlock features. FRPB is
              not responsible for loss of data, photos, messages, accounts or other
              content resulting from your use of the Software. You use the Software at
              your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              7. Subscription and Payments
            </h2>
            <p>
              If you purchase a subscription plan:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Your subscription begins when payment is successfully processed.</li>
              <li>The subscription renews automatically at the end of each billing
                period unless you cancel before the renewal date.</li>
              <li>You may cancel at any time; cancellation stops future renewals but
                does not refund fees already paid, except where the law requires
                otherwise or as set out in our Refund Policy.</li>
              <li>If a payment fails, your access may be suspended until payment is
                successfully completed.</li>
              <li>Licenses are personal to the account that purchased them and may not
                be shared, sold or transferred to another person or account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Termination
            </h2>
            <p>
              This licence continues until terminated. It terminates automatically:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>If you breach this Agreement and do not cure the breach within a
                reasonable period after notice.</li>
              <li>If you engage in fraud, abuse, or use the Software in violation of
                applicable law.</li>
              <li>Upon written request by FRPB where the Software is no longer
                available, provided that any prepaid, non-refundable fees are not
                refunded except as required by law.</li>
            </ul>
            <p>
              On termination, you must stop using the Software and uninstall it from all
              computers. Sections that by their nature should survive — including
              ownership, payments, liability limits and dispute resolution — remain in
              effect after termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              9. Disclaimer of Warranties
            </h2>
            <p>
              THE SOFTWARE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF
              ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND
              NON-INFRINGEMENT. FRPB DOES NOT WARRANT THAT THE SOFTWARE WILL BE
              UNINTERRUPTED, ERROR-FREE, SECURE OR THAT IT WILL MEET YOUR EXPECTATIONS.
            </p>
            <p>
              Device recovery, reset and unlock operations inherently carry risk,
              including the risk of data loss, device damage or rendering a device
              unusable. You are solely responsible for deciding whether to use the
              Software and for any outcomes of that use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              10. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FRPB SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, USE, GOODWILL OR
              OTHER INTANGIBLE LOSS, ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE
              USE OR INABILITY TO USE THE SOFTWARE, EVEN IF FRPB HAS BEEN ADVISED OF THE
              POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              FRPB’S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF THIS AGREEMENT
              WILL NOT EXCEED THE AMOUNT YOU PAID TO FRPB IN THE TWELVE (12) MONTHS
              IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED
              U.S. DOLLARS (USD 100) IF YOU HAVE NOT PAID ANY FEES. THE FOREGOING
              LIMITATIONS APPLY ONLY TO THE EXTENT NOT PROHIBITED BY LAW.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              11. Indemnification
            </h2>
            <p>
              You agree to defend, indemnify and hold harmless FRPB and its officers,
              employees and agents from and against any claims, damages, losses and
              expenses (including reasonable legal fees) arising out of or relating to
              your breach of this Agreement, your use of the Software in violation of
              applicable law, or your violation of any third party’s rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              12. Governing Law and Dispute Resolution
            </h2>
            <p>
              This Agreement is governed by the laws of India, without regard to its
              conflict of laws principles. Any dispute arising out of or relating to this
              Agreement that cannot be resolved amicably shall be subject to the
              exclusive jurisdiction of the courts located in India, unless mandatory law
              provides otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              13. General Provisions
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Severability.</strong> If any provision of this Agreement is held
                invalid or unenforceable, the remaining provisions remain in full force.
              </li>
              <li>
                <strong>Waiver.</strong> Our failure to enforce any right under this
                Agreement does not waive that right.
              </li>
              <li>
                <strong>Entire Agreement.</strong> This Agreement, together with any
                applicable order, invoice or plan terms, constitutes the entire
                agreement between you and FRPB regarding the Software and supersedes all
                prior or contemporaneous communications.
              </li>
              <li>
                <strong>Amendments.</strong> We may amend this Agreement by posting the
                amended version on our website with an updated “Last updated” date. Your
                continued use of the Software after the effective date of an amendment
                constitutes acceptance.
              </li>
              <li>
                <strong>Contact.</strong> Questions about this Agreement should be sent to{" "}
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
