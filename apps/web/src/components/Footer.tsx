// FRPB — premium dark site footer.
// Sweeps the homepage's footer content onto a black canvas with a hairline top
// border, brand lockup, social icons, product/platform/help columns, and a
// compliance bottom bar. Reuses the compliance copy from config/legal.ts and
// the resolved installer URL from config/download.ts.
//
// Server component: static links + a presentational language <select> only.

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, Instagram, Mail, Send, ShieldCheck } from "lucide-react";
import { resolveInstallerUrl } from "@/config/download";
import {
  COMPANY_ADDRESS,
  COMPANY_ENTITY,
  LEGAL_DISCLAIMER,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";

interface FooterColumn {
  heading: string;
  links: readonly { label: string; href: string }[];
}

interface SocialLink {
  label: string;
  href: string;
  icon: typeof Send;
}

const SOCIALS: readonly SocialLink[] = [
  { label: "Join FRPB on Telegram", href: "https://t.me/frpbnetwork", icon: Send },
  {
    label: "Follow FRPB on Instagram",
    href: "https://www.instagram.com/frpbofficial",
    icon: Instagram,
  },
  { label: "Email FRPB support", href: mailtoHref(SUPPORT_EMAIL), icon: Mail },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
] as const;

export default function Footer() {
  const downloadUrl = resolveInstallerUrl();
  const year = new Date().getFullYear();

  const columns: readonly FooterColumn[] = [
    {
      heading: "Hero Products",
      links: [
        { label: "Android FRP Bypass Tool", href: "/#features" },
        { label: "iOS Screen & Lock Unlock", href: "/#device-showcase" },
        { label: "Device Recovery Suite", href: "/#features" },
        { label: "Free Desktop Utilities", href: "/#free-tools" },
        { label: "Download for Windows & macOS", href: downloadUrl },
      ],
    },
    {
      heading: "FRPB Platform",
      links: [
        { label: "About Us", href: "/#guides" },
        { label: "Features", href: "/#features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      heading: "Help Center",
      links: [
        { label: "Contact Us", href: mailtoHref(SUPPORT_EMAIL) },
        { label: "License Recovery", href: "/recover" },
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
  ];

  return (
    <footer id="eula" className="relative border-t border-white/10 bg-black text-slate-400">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="FRPB — FRP bypass and Android device recovery tool"
                width={72}
                height={72}
                loading="lazy"
                className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
              />
              <span className="text-lg font-extrabold tracking-tight text-white">FRPB</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm font-semibold leading-relaxed text-slate-200">
              Creativity & Unlocking Simplified!
            </p>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
              The professional Android FRP unlock and device utility suite — built for
              technicians, repair shops and authorized device owners.
            </p>

            {/* Social links */}
            <div className="mt-6 flex items-center gap-2.5">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Content columns */}
          {columns.map((column) => (
            <div key={column.heading}>
              <h4 className="text-sm font-bold text-white">{column.heading}</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-slate-400 transition hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal / DPDP disclaimer — site-wide small print. */}
        <p className="mt-12 max-w-4xl text-xs leading-relaxed text-slate-600">
          {LEGAL_DISCLAIMER}
        </p>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-8 lg:flex-row">
          <div className="text-center lg:text-left">
            <p className="text-xs text-slate-500">
              Copyright © {year} FRPB. All rights reserved.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Operated by {COMPANY_ENTITY} · {COMPANY_ADDRESS}
            </p>
          </div>

          <nav
            aria-label="Legal policies"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400"
          >
            <Link href="/terms" className="transition hover:text-white">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/refund" className="transition hover:text-white">
              Refund Policy
            </Link>
          </nav>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={mailtoHref(LEGAL_EMAIL)}
              className="flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {LEGAL_EMAIL}
            </a>

            {/* Language selector (presentational placeholder). */}
            <div className="relative">
              <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                aria-label="Select language"
                defaultValue="en"
                className="appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-8 text-xs text-slate-300 outline-none transition hover:border-white/20 focus:border-white/30"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value} className="bg-neutral-900">
                    {language.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
