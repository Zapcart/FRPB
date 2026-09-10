// FRPB — dev Electron launcher.
//
// This machine has `ELECTRON_RUN_AS_NODE=1` set as a user/session environment
// variable. When that variable is present, the Electron binary boots in
// plain-Node mode: `require("electron")` no longer returns the built-in module
// (app/ipcMain/BrowserWindow are all `undefined`), and the main process crashes
// at module load. This launcher spawns the real Electron binary with that
// variable *deleted* from the child environment, so the native desktop window
// can open normally. It is only used by the `dev:electron` script.

const { spawn } = require("node:child_process");
const path = require("node:path");

// Resolve the Electron executable the same way the `electron` npm package does.
const electronPath = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log(`[frpb:dev] launching Electron: ${electronPath}`);
console.log("[frpb:dev] ELECTRON_RUN_AS_NODE cleared from child environment.");

const child = spawn(electronPath, [path.join(__dirname, "..")], {
  stdio: "inherit",
  env,
});

child.on("error", (err) => {
  console.error("[frpb:dev] failed to spawn Electron:", err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  console.log(`[frpb:dev] Electron exited (code=${code}, signal=${signal ?? "none"})`);
  process.exit(code ?? 0);
});
