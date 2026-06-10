import { SteppedBackoff } from "./stepped-backoff.ts";

type LimiterEntry = {
  backoff: SteppedBackoff;
  nextAllowedAt: number;
};

/** Per-key stepped rate limit: {@link shouldLog} true only after backoff window ends */
export class RateLimitedLogger {
  private readonly entries = new Map<string, LimiterEntry>();

  constructor(private readonly delaysMs?: readonly number[]) {}

  /** Whether to emit this log line; when true, advances next wait window for that key */
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
