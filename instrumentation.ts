export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDdnsScheduler } = await import("@/lib/scheduler");
  startDdnsScheduler();
}
