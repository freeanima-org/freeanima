/** 在控制台保留完整堆栈，便于 bundled / Electron 调试 */
export function logCaughtError(context: string, error: unknown): void {
  const label = `[console:${context}]`;
  if (error instanceof Error) {
    console.error(label, error);
    return;
  }
  console.error(label, error);
}

/** loader 等可降级场景：记录错误并返回 fallback */
export function catchWithFallback<T>(context: string, fallback: T): (error: unknown) => T {
  return (error: unknown) => {
    logCaughtError(context, error);
    return fallback;
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
