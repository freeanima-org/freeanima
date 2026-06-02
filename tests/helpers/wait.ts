/** 轮询直到 predicate 为真或超时（测试用） */
export async function waitFor(
  predicate: () => boolean,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const intervalMs = opts?.intervalMs ?? 25;
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
