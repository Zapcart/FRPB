import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Renderer-only Vite config. The Electron main + preload processes are compiled
// separately with tsc (tsconfig.electron.json) into dist-electron/.
// A custom dev script boots `vite` + `electron` together via VITE_DEV_SERVER_URL.
// NOTE: electron-updater is only ever required from the main process (compiled
// by tsc, never bundled by Vite), so it stays external by construction and is
// resolved at runtime from the unpacked ASAR folder.
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
    rollupOptions: {
      // Defensive: keep Electron's native update modules out of the renderer
      // bundle even if a transitive import ever pulls them in.
      external: ["electron-updater"],
    },
  },
});
