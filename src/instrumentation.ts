/**
 * Runs once when a server process starts (Next.js instrumentation hook).
 * Starts the per-minute server resource sampler for Admin → وضعیت سرور — only in the Node.js server,
 * never during `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startServerMetricsSampler } = await import("./features/server-status/sampler");
  startServerMetricsSampler();
}
