import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Renderer-only Vite config. The Electron main + preload processes are compiled
// separately with tsc (tsconfig.electron.json) into dist-electron/.
// A custom dev script boots `vite` + `electron` together via VITE_DEV_SERVER_URL.
export default defineConfig({
  plugins: [react()],
  base: "./",
  root: ".",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Sourcemaps are never shipped: they embed original module sources and
    // bloat the asar (~400KB). Dev-time debugging still works because Vite's
    // dev server serves inline maps on demand.
    sourcemap: false,
  },
});
