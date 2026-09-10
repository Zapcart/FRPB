// FRPB — Minimal structured logger for the main process.
// Console output only; keeps production noise low.

type Level = "debug" | "info" | "warn" | "error";

const ENABLED_LEVELS: Record<Level, boolean> = {
  debug: process.env.FRPB_DEBUG === "1",
  info: true,
  warn: true,
  error: true,
};

function write(level: Level, ...args: unknown[]): void {
  if (!ENABLED_LEVELS[level]) return;
  const ts = new Date().toISOString();
  const fn =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[frpb:${level}] ${ts}`, ...args);
}

export const log = {
  debug: (...args: unknown[]) => write("debug", ...args),
  info: (...args: unknown[]) => write("info", ...args),
  warn: (...args: unknown[]) => write("warn", ...args),
  error: (...args: unknown[]) => write("error", ...args),
};
