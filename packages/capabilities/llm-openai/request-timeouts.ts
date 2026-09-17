/** LLM chat 应用层超时：连接/响应头 / 首字节 / 整体 / chunk idle */

export type LlmTimeoutKind = "connect" | "first_byte" | "overall" | "idle";

export class LlmTimeoutError extends Error {
  readonly kind: LlmTimeoutKind;
  readonly timeoutMs: number;

  constructor(kind: LlmTimeoutKind, timeoutMs: number) {
    super(`LLM ${kind} timeout after ${timeoutMs}ms`);
    this.name = "LlmTimeoutError";
    this.kind = kind;
    this.timeoutMs = timeoutMs;
  }
}

export function isLlmTimeoutError(err: unknown): err is LlmTimeoutError {
  return err instanceof LlmTimeoutError;
}

/** 从 Error / AbortSignal.reason 链上取出 LlmTimeoutError */
export function extractLlmTimeoutError(err: unknown): LlmTimeoutError | null {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof LlmTimeoutError) return cur;
    if (typeof cur === "object" && cur !== null && "reason" in cur) {
      const reason = (cur as { reason?: unknown }).reason;
      if (reason instanceof LlmTimeoutError) return reason;
      if (reason !== undefined && reason !== cur) {
        cur = reason;
        continue;
      }
    }
    if (cur instanceof Error && cur.cause !== undefined) {
      cur = cur.cause;
      continue;
    }
    break;
  }
  return null;
}

const clearTimer = (t: ReturnType<typeof setTimeout> | null) => {
  if (t != null) clearTimeout(t);
};

export type LlmTimeoutController = {
  signal: AbortSignal;
  /** 非流：响应体已返回；流式：也可用 onChunk 代替 */
  onFirstByte: () => void;
  /** 流式：每个 chunk（含首包） */
  onChunk: () => void;
  dispose: () => void;
};

/**
 * @param idleMs 传 null/undefined 表示关闭 idle（非流式）
 */
export function createLlmTimeoutController(opts: {
  overallMs: number;
  firstByteMs: number;
  idleMs?: number | null;
  /** 用户 interrupt；与超时任一触发即 abort，超时 reason 仍为 LlmTimeoutError */
  external?: AbortSignal;
}): LlmTimeoutController {
  const ac = new AbortController();
  let firstByteTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let overallTimer: ReturnType<typeof setTimeout> | null = null;
  let firstByteDone = false;
  let disposed = false;

  const abort = (kind: LlmTimeoutKind, ms: number) => {
    if (disposed || ac.signal.aborted) return;
    ac.abort(new LlmTimeoutError(kind, ms));
  };

  const onExternalAbort = () => {
    if (disposed || ac.signal.aborted) return;
    ac.abort(opts.external?.reason);
  };

  if (opts.external) {
    if (opts.external.aborted) {
      onExternalAbort();
    } else {
      opts.external.addEventListener("abort", onExternalAbort);
    }
  }

  overallTimer = setTimeout(() => abort("overall", opts.overallMs), opts.overallMs);
  firstByteTimer = setTimeout(() => abort("first_byte", opts.firstByteMs), opts.firstByteMs);

  const clearFirstByte = () => {
    clearTimer(firstByteTimer);
    firstByteTimer = null;
    firstByteDone = true;
  };

  const resetIdle = () => {
    const idleMs = opts.idleMs;
    if (idleMs == null || idleMs <= 0) return;
    clearTimer(idleTimer);
    idleTimer = setTimeout(() => abort("idle", idleMs), idleMs);
  };

  const dispose = () => {
    disposed = true;
    opts.external?.removeEventListener("abort", onExternalAbort);
    clearTimer(firstByteTimer);
    clearTimer(idleTimer);
    clearTimer(overallTimer);
    firstByteTimer = null;
    idleTimer = null;
    overallTimer = null;
  };

  return {
    signal: ac.signal,
    onFirstByte: () => {
      if (disposed) return;
      clearFirstByte();
      resetIdle();
    },
    onChunk: () => {
      if (disposed) return;
      if (!firstByteDone) clearFirstByte();
      resetIdle();
    },
    dispose,
  };
}

/** 合并 LLM 自身超时 signal 与调用方墙钟 / 取消 signal（任一 abort 即取消 fetch） */
export function mergeAbortSignals(
  timeoutSignal: AbortSignal,
  external?: AbortSignal | null,
): AbortSignal {
  if (!external) return timeoutSignal;
  return AbortSignal.any([timeoutSignal, external]);
}
