/**
 * 自动保存调度：防抖（idle 后触发）+ 节流窗口（maxWait，连续输入时到期强制触发）。
 * 语义对齐 lodash debounce 的 maxWait。
 */

export type AutoPersistTiming = {
  /** 闲置满该时长后触发（trailing debounce） */
  debounceMs: number;
  /** 自本轮首次 schedule 起最长等待；到期即使仍在输入也触发 */
  maxWaitMs: number;
};

/** 长文本（日记正文、任务/项目 content、聊天草稿等） */
export const AUTO_PERSIST_LONG: AutoPersistTiming = {
  debounceMs: 1000,
  maxWaitMs: 5000,
};

/** 短文本 / 数字配置（标题旁路、伴侣/番茄数字框等） */
export const AUTO_PERSIST_SHORT: AutoPersistTiming = {
  debounceMs: 400,
  maxWaitMs: 2000,
};

export type CreateAutoPersistSchedulerOptions = AutoPersistTiming & {
  onFire: () => void;
  now?: () => number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
};

export type AutoPersistScheduler = {
  /** 有待落盘改动时调用；重置防抖并受 maxWait 约束 */
  schedule: () => void;
  /** 取消待触发，不调用 onFire */
  cancel: () => void;
  /** 若有待触发则立即 onFire 并清空计时 */
  flush: () => void;
  isPending: () => boolean;
};

export function createAutoPersistScheduler(
  opts: CreateAutoPersistSchedulerOptions,
): AutoPersistScheduler {
  const {
    debounceMs,
    maxWaitMs,
    onFire,
    now = () => Date.now(),
    setTimeoutFn = setTimeout as (fn: () => void, ms: number) => unknown,
    clearTimeoutFn = clearTimeout as (id: unknown) => void,
  } = opts;

  if (debounceMs < 0 || maxWaitMs < 0) {
    throw new Error("auto-persist: debounceMs and maxWaitMs must be >= 0");
  }
  if (maxWaitMs > 0 && maxWaitMs < debounceMs) {
    throw new Error("auto-persist: maxWaitMs must be >= debounceMs when maxWaitMs > 0");
  }

  let timer: unknown = null;
  let windowStart: number | null = null;

  const clearTimer = () => {
    if (timer != null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  };

  const fire = () => {
    clearTimer();
    windowStart = null;
    onFire();
  };

  const schedule = () => {
    const t = now();
    if (windowStart == null) windowStart = t;

    clearTimer();

    const elapsed = t - windowStart;
    const remainingMax = maxWaitMs > 0 ? maxWaitMs - elapsed : Number.POSITIVE_INFINITY;

    if (remainingMax <= 0) {
      fire();
      return;
    }

    const delay = Math.min(debounceMs, remainingMax);
    timer = setTimeoutFn(() => {
      timer = null;
      fire();
    }, delay);
  };

  const cancel = () => {
    clearTimer();
    windowStart = null;
  };

  const flush = () => {
    if (timer == null && windowStart == null) return;
    fire();
  };

  const isPending = () => timer != null || windowStart != null;

  return { schedule, cancel, flush, isPending };
}
