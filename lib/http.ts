export function timeoutSignal(seconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), seconds * 1000);
  return { signal: controller.signal, dispose: () => clearTimeout(timeout) };
}

export function describeFetchError(error: unknown, target: string) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return `${target} is not reachable (${error.message}${cause})`;
  }

  return `${target} is not reachable`;
}
