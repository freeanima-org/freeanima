/** Default steps: 100ms → 1s → 10s → 1min, then hold last */
export const DEFAULT_STEPPED_DELAYS_MS = [100, 1_000, 10_000, 60_000] as const;

/** Stepped backoff; each {@link nextDelayMs} consumes a step and increments attempt */
export class SteppedBackoff {
  private _attempt = 0;

  constructor(private readonly delaysMs: readonly number[] = DEFAULT_STEPPED_DELAYS_MS) {
    if (delaysMs.length === 0) {
      throw new Error("SteppedBackoff: delaysMs cannot be empty");
    }
  }

  get attempt(): number {
    return this._attempt;
  }

  /** Return current step delay (ms) and increment attempt */
  nextDelayMs(): number {
    const idx = Math.min(this._attempt, this.delaysMs.length - 1);
    const delay = this.delaysMs[idx]!;
    this._attempt += 1;
    return delay;
  }

  /** Reset attempt on success; next starts from first step */
  reset(): void {
    this._attempt = 0;
  }
}
