/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@frpb/shared"],
  // Canonical/trailing-slash consistency: every route is served without a
  // trailing slash and Next 308-redirects the dotted variant, so the canonical
  // URL emitted in metadata always matches the served URL.
  trailingSlash: false,
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
            value: 'attachment; filename="FRPB-Setup.exe"',
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
