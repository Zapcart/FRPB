/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@frpb/shared"],
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
