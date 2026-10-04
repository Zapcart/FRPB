// FRPB — Next.js instrumentation hook.
//
// `register()` runs once per server process at boot (enabled via
// `experimental.instrumentationHook` in next.config.mjs). It is the correct
// place for one-time startup diagnostics that must not run on the request path.
//
// Currently it emits the production test-key security warning. See the
// "Test-key lockdown" section of plans/performance-optimization.md.

export async function register(): Promise<void> {
  // Instrumentation also loads in the Edge runtime; the process-env security
  // checks below only make sense on the Node server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import keeps this module off the Edge bundle and defers any
  // transitive cost until the Node runtime actually initialises.
  const { warnIfInsecureTestConfig } = await import("@/lib/license/test-key");
  warnIfInsecureTestConfig();
}
