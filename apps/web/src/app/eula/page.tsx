// FRPB — End User License Agreement (EULA)
// Server component. Static legal page governing how a user may use FRPB.
// Not legal advice — have a qualified lawyer review before publishing if you
// need a binding agreement in your jurisdiction.

import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import {
  COMPANY_JURISDICTION,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

export const metadata = pageMetadata({
  title: "End User License Agreement",
  description:
    "End User License Agreement for FRPB — licensed (not sold) software, per-plan device activation limits, authorised repair-technician guardrails, and termination terms.",
  path: "/eula",
});

export default function EULAPage() {
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
          End User License Agreement
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
            <h2 className="text-lg font-bold text-ink">1. Acceptance</h2>
            <p>
              By installing, copying, accessing or using FRPB (“the Software”), you
              agree to be bound by this End User License Agreement (“Agreement”). If
              you do not agree, do not install or use the Software. This Agreement
              takes effect on the earlier of your first installation, activation or
              use of the Software.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              2. Licensed, Not Sold
            </h2>
            <p>
              <strong>
                The Software is licensed to you, not sold.
              </strong>{" "}
              You acquire no ownership interest in the Software. FRPB and its
              licensors retain all right, title and interest in and to the Software,
              including all copies, updates, modifications and derivative works. All
              rights not expressly granted in this Agreement are reserved by FRPB.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">3. License Grant</h2>
            <p>
              Subject to your compliance with this Agreement, FRPB grants you a
              limited, <strong>non-exclusive, non-transferable, non-sublicensable and
              revocable</strong> licence to use the Software for your personal or
              professional<strong> device recovery and repair</strong> needs. The
              scope of your use is defined by the plan you have purchased:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>6-Month Plan</strong> — permits activation on{" "}
                <strong>one (1) device at a time</strong>, for one hundred and eighty
                (180) days from the date of purchase. A different device may be
                substituted only after the previously bound device is deactivated
                through your dashboard.
              </li>
              <li>
                <strong>Lifetime Plan</strong> — permits activation on up to{" "}
                <strong>five (5) devices</strong> in total, on a perpetual basis,
                subject to the restrictions below and to the activation/binding rules
                shown in your dashboard.
              </li>
            </ul>
            <p>
              You may install the Software on any number of computers, but you may
              activate and use it only on the specific number of devices permitted by
              your plan. A device is counted once it has been activated under your
              account; activation is bound to the device’s hardware identifier.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              4. Authorised Use — Device Ownership and Repair Technicians Only
            </h2>
            <p>
              The Software is a professional recovery utility intended{" "}
              <strong>strictly</strong> for:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Authorised device owners</strong> — individuals who own the
                device being serviced; and
              </li>
              <li>
                <strong>Certified / professional repair technicians</strong> — who
                have the lawful, documented authorisation of the device’s owner to
                service that specific device.
              </li>
            </ul>
            <p>
              You represent and warrant that, for every device you service using the
              Software, you either own the device or hold the device owner’s lawful
              consent or written authorisation. You are solely responsible for
              ensuring that any recovery, reset, unlock or FRP-removal operation
              complies with applicable law, the device manufacturer’s terms, and the
              rights of the device owner and any person whose data is on the device.
            </p>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong className="font-semibold">
                Stolen-device and unauthorised-device disclaimer.
              </strong>{" "}
              Using FRPB to bypass, remove or defeat security protections on a device
              you do not own or are not authorised in writing to service is strictly
              prohibited and may be a criminal offence. FRPB does not support, and
              expressly disclaims any involvement in, the servicing of stolen devices
              or devices obtained without the owner’s consent.
            </div>
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
              <li>
                <strong>Reverse engineer</strong>, decompile, disassemble, modify,
                translate, create derivative works of, or otherwise attempt to derive
                or discover the source code, underlying algorithms, activation logic
                or licence-verification mechanisms of the Software, except to the
                extent this is expressly permitted by mandatory applicable law.
              </li>
              <li>Rent, lease, sublicense, sell, resell, distribute, loan, share or
                otherwise provide the Software or your licence key to any third party,
                except that you may install it on your own computers for your own use.</li>
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
              If you purchase a subscription or licence plan:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>Your licence begins when payment is successfully processed.</li>
              <li>The subscription renews automatically at the end of each billing
                period unless you cancel before the renewal date.</li>
              <li>You may cancel at any time; cancellation stops future renewals but
                does not refund fees already paid, except where the law requires
                otherwise or as set out in our{" "}
                <a href="/refund" className="text-brand-600 hover:underline">
                  Refund Policy
                </a>.</li>
              <li>If a payment fails, your access may be suspended until payment is
                successfully completed.</li>
              <li>Licenses are personal to the account that purchased them and may not
                be shared, sold or transferred to another person or account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              8. Immediate Termination for Breach
            </h2>
            <p>
              We may suspend or terminate this licence <strong>immediately,
              without prior notice</strong>, if you:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-1 text-slate-600">
              <li>breach any material term of this Agreement;</li>
              <li>
                attempt to reverse engineer, decompile, circumvent or disable the
                Software’s licence-verification or activation mechanisms;
              </li>
              <li>
                use the Software on a device you do not own or are not authorised to
                service, or in violation of applicable law; or
              </li>
              <li>
                engage in fraud, abuse, chargeback fraud, or share your licence key with
                third parties.
              </li>
            </ul>
            <p>
              Termination also occurs automatically if you breach this Agreement and
              do not cure the breach within a reasonable period after notice from us,
              or upon written request by FRPB where the Software is no longer made
              available. On termination you must immediately stop using the Software
              and uninstall it from all computers, and your licence key will be
              deactivated and rendered unusable. Sections that by their nature should
              survive — including ownership, payments, liability limits, indemnity and
              dispute resolution — remain in effect after termination.
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
              FRPB’S TOTAL AGGREGATE LIABILITY TO YOU FOR ANY AND ALL CLAIMS ARISING
              OUT OF OR RELATING TO THIS AGREEMENT WILL BE{" "}
              <strong>
                LIMITED STRICTLY TO THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO FRPB FOR
                THE LICENCE GIVING RISE TO THE CLAIM
              </strong>
              , OR ONE HUNDRED U.S. DOLLARS (USD 100) IF YOU HAVE NOT PAID ANY FEES.
              THE FOREGOING LIMITATIONS APPLY ONLY TO THE EXTENT NOT PROHIBITED BY LAW.
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
              applicable law, or your violation of any third party’s rights — including
              any claim brought by a device owner whose device you serviced without
              authorisation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">
              12. Governing Law and Dispute Resolution
            </h2>
            <p>
              This Agreement is governed by the laws of {COMPANY_JURISDICTION}, without
              regard to its conflict of laws principles, and the United Nations
              Convention on Contracts for the International Sale of Goods is expressly
              excluded. Any dispute arising out of or relating to this Agreement shall
              first be subject to good-faith negotiation for thirty (30) days, failing
              which it shall be referred to and finally resolved by arbitration under
              the Arbitration and Conciliation Act, 1996. The seat and venue of
              arbitration shall be in {COMPANY_JURISDICTION}, the language shall be
              English, and the award shall be final and binding.
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
                <strong>Contact.</strong> Questions about this Agreement should be sent
                to{" "}
                <a
                  href={mailtoHref(SUPPORT_EMAIL)}
                  className="text-brand-600 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                or{" "}
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
