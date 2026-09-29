import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// FRPB — Vitest configuration for @frpb/web.
//
// The referral engine's pure domain modules (config / progress / commission /
// fraud) are dependency-free so they can be unit tested in a plain Node
// environment with zero DB / Redis / network access.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    clearMocks: true,
    reporters: ["default"],
  },
});
