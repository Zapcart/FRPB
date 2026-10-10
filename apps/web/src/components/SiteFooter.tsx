// FRPB — site-wide footer wrapper (client-only).
//
// The marketing pages (home, tools, brand hubs, blog, legal, about, contact)
// previously only rendered the footer on the home route. For AdSense/quality
// purposes every crawlable page needs a proper, consistent header/footer and a
// clear path to the legal pages, so this wrapper mounts <Footer /> across the
// whole marketing surface.
//
// It is route-gated on the client:
//   • the home route ("/") renders its own <Footer />, so we skip it here to
//     avoid a duplicate footer;
//   • the authenticated/app routes (auth, dashboard, admin, checkout, login,
//     register) declare their own opaque chrome and are excluded.
//
// The footer markup itself stays a Server Component element passed in from the
// root layout; this wrapper only decides whether to paint it, which keeps the
// static footer HTML in the server-rendered tree (good for crawlers).

"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

/** App surfaces that render their own full-height chrome and must not inherit
 *  the marketing footer. */
const EXCLUDED_PREFIXES = [
  "/auth",
  "/login",
  "/register",
  "/dashboard",
  "/admin",
  "/checkout",
] as const;

export default function SiteFooter() {
  const pathname = usePathname();

  // Home renders its own footer.
  if (pathname === "/") return null;

  // Exclude the authenticated / transactional surfaces.
  if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // `id` is nulled so the route-gated footer does not duplicate the `#eula`
  // anchor target that the home page owns.
  return <Footer id={undefined} />;
}
