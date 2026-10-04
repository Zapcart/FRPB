// FRPB — PM2 process configuration for the Next.js web app on EC2.
//
// The web app does NOT use Next.js `output: "standalone"`, so PM2 must run the
// regular `next start` server (NOT a generated server.js). We bind to
// 127.0.0.1:3000 so only the local Nginx reverse proxy can reach the app.
//
// Usage (from the repo root on the EC2 instance):
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save
//
// Environment variables are NOT defined here. They are loaded from
// apps/web/.env.production via the deploy script / PM2 before start. Never
// commit real secrets to this file.
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const LOG_DIR = process.env.FRPB_LOG_DIR || "/var/log/frpb";

module.exports = {
  apps: [
    {
      name: "frpb-web",
      cwd: WEB_ROOT,
      // Resolve the locally installed Next.js binary; avoids relying on a
      // global install and keeps the version pinned to the lockfile.
      script: path.join("node_modules", "next", "dist", "bin", "next"),
      args: "start --port 3000 --hostname 127.0.0.1",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      // Restart if the process leaks past this threshold (Free Tier has 1 GB RAM).
      max_memory_restart: "512M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        // Bound the V8 old-space so the process does not lazily reserve memory
        // it never needs on a 1–2 GB box. 384 MB leaves headroom under the
        // 512M `max_memory_restart` ceiling for RSS overshoot + the ~50 MB
        // baseline of the Next.js runtime, OS and Nginx. Without this, V8 sizes
        // its heap from total system RAM and can push the process toward the
        // restart threshold during build/route compilation spikes.
        NODE_OPTIONS: "--max-old-space-size=384",
      },
      error_file: path.join(LOG_DIR, "frpb-web-error.log"),
      out_file: path.join(LOG_DIR, "frpb-web-out.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
