import type { MemoryProvenance } from "./types.ts";

/**
 * retain 执行期间注入 provenance + acting agent，供 semantic create / AutoLlm subject。
 * 非 AsyncLocalStorage：AutoLLM 工具调用与 retain 同进程同步链。
 */
let active: MemoryProvenance | null = null;
let activeAgentSubjectId: number | null = null;

export function getActiveRetainProvenance(): MemoryProvenance | null {
  return active;
}

export function getActiveRetainAgentSubjectId(): number | null {
  return activeAgentSubjectId;
}

export async function withRetainProvenance<T>(
  source: MemoryProvenance,
  fn: () => Promise<T>,
  opts?: { agent_subject_id?: number },
): Promise<T> {
  const prev = active;
  const prevAgent = activeAgentSubjectId;
  active = source;
  activeAgentSubjectId =
    opts?.agent_subject_id != null && opts.agent_subject_id > 0 ? opts.agent_subject_id : null;
  try {
    return await fn();
  } finally {
    active = prev;
    activeAgentSubjectId = prevAgent;
  }
}
