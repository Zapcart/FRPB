/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@frpb/shared"],
  // Canonical/trailing-slash consistency: every route is served without a
  // trailing slash and Next 308-redirects the dotted variant, so the canonical
  // URL emitted in metadata always matches the served URL.
  trailingSlash: false,
  // Gzip/Brotli-compress HTML + text responses at the edge (reduces transfer
  // size for the document itself — the primary mobile LCP resource).
  compress: true,
  // Drop the `X-Powered-By: Next.js` fingerprint header (byte savings + a
  // smaller disclosure surface).
  poweredByHeader: false,
  images: {
    // Serve modern formats first; next/image falls back to the original PNG.
    formats: ["image/avif", "image/webp"],
    // /logo.png is a 1344x1638 portrait source rendered at small sizes.
    deviceSizes: [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048],
  },
  experimental: {
    // Keep server actions scoped; we rely on route handlers for licensing
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        // Immutable, content-hashed build output (JS/CSS/fonts emitted by
        // next/font). Safe to cache for a year — the single biggest win for
        // repeat-visit LCP, since the browser skips the network entirely.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Non-hashed public media/font/icon assets: cache for a week with
        // stale-while-revalidate so repeat loads serve instantly from disk
        // while a fresh copy refreshes in the background.
        source:
          "/:path*.(png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Public license/checkout/webhook endpoints are consumed by the desktop client
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Installer binaries served straight from public/downloads must always
        // be treated as opaque downloads — never rendered/executed by a browser.
        source: "/downloads/:file*.exe",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="FRPB-Recovery-Setup-1.0.1.exe"',
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async rewrites() {
    // PostHog first-party reverse proxy.
    //
    // Browser telemetry is sent to same-origin `/ingest/*` and transparently
    // forwarded to PostHog's US ingestion + asset hosts. Serving analytics from
    // our own domain means ad-blockers / privacy extensions that pattern-match
    // `*.posthog.com` no longer drop the events, and the requests share the
    // first-party cookie jar — improving event capture rate and attribution.
    //
    // Order matters: Next matches rewrites top-to-bottom, so the static-asset
    // and `/decide` rules MUST precede the greedy `:path*` catch-all.
    return [
      {
        // Script/asset bundle (e.g. array.js, surveys.js) served by the CDN host.
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        // Feature-flag / session-recording decision endpoint. Listed before the
        // catch-all so it is never swallowed by the generic `/:path*` rule.
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
      {
        // Everything else: event capture, flags, persons (`/e/`, `/flags/`, ...).
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
};

export default nextConfig;
