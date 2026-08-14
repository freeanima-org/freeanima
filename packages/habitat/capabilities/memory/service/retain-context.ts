import type { MemoryProvenance } from "./types.ts";

/**
 * retain 执行期间注入 provenance，供 semantic create 工具写入 source。
 * 非 AsyncLocalStorage：AutoLLM 工具调用与 retain 同进程同步链。
 */
let active: MemoryProvenance | null = null;

export function getActiveRetainProvenance(): MemoryProvenance | null {
  return active;
}

export async function withRetainProvenance<T>(
  source: MemoryProvenance,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = active;
  active = source;
  try {
    return await fn();
  } finally {
    active = prev;
  }
}
