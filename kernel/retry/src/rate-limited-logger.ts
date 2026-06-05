import { SteppedBackoff } from "./stepped-backoff.ts";

type LimiterEntry = {
  backoff: SteppedBackoff;
  nextAllowedAt: number;
};

/** 按 key 独立阶梯限频：仅在退避窗口结束后 {@link shouldLog} 返回 true */
export class RateLimitedLogger {
  private readonly entries = new Map<string, LimiterEntry>();

  constructor(private readonly delaysMs?: readonly number[]) {}

  /** 是否应输出本条日志；为 true 时已推进该 key 的下一等待窗口 */
  shouldLog(key: string, nowMs: number = Date.now()): boolean {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { backoff: new SteppedBackoff(this.delaysMs), nextAllowedAt: 0 };
      this.entries.set(key, entry);
    }
    if (nowMs < entry.nextAllowedAt) {
      return false;
    }
    const delay = entry.backoff.nextDelayMs();
    entry.nextAllowedAt = nowMs + delay;
    return true;
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(key);
  }
}
