export const STREAM_FIRST_FLUSH_MIN_CHARS = 30;
export const STREAM_FIRST_FLUSH_MAX_WAIT_MS = 500;

export type FirstFlushGateOptions = {
  minChars?: number;
  maxWaitMs?: number;
};

export type FirstFlushGate = {
  isOpen: () => boolean;
  /** 缓冲更新时调用；gate 未开则按 minChars/maxWaitMs 决定何时 onReady */
  onDelta: (buffer: string, onReady: () => void | Promise<void>) => void;
  /** 流结束前强制打开 gate（短回答场景） */
  flushPending: (onReady: () => void | Promise<void>) => Promise<void>;
  dispose: () => void;
};

export function createFirstFlushGate(opts?: FirstFlushGateOptions): FirstFlushGate {
  const minChars = opts?.minChars ?? STREAM_FIRST_FLUSH_MIN_CHARS;
  const maxWaitMs = opts?.maxWaitMs ?? STREAM_FIRST_FLUSH_MAX_WAIT_MS;

  let open = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingReady: (() => void | Promise<void>) | undefined;

  const openGate = async (onReady: () => void | Promise<void>): Promise<void> => {
    if (open) return;
    open = true;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    await onReady();
  };

  return {
    isOpen: () => open,
    onDelta(buffer, onReady) {
      if (open) return;
      pendingReady = onReady;
      if (buffer.trim().length >= minChars) {
        void openGate(onReady);
        return;
      }
      if (!timer) {
        timer = setTimeout(() => {
          timer = undefined;
          if (!open && pendingReady) {
            void openGate(pendingReady);
          }
        }, maxWaitMs);
      }
    },
    async flushPending(onReady) {
      if (open) return;
      await openGate(onReady);
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      pendingReady = undefined;
      open = false;
    },
  };
}
