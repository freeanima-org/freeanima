/** 默认阶梯：100ms → 1s → 10s → 1min，之后保持末档 */
export const DEFAULT_STEPPED_DELAYS_MS = [100, 1_000, 10_000, 60_000] as const;

/** 按阶梯递增的退避；每次 {@link nextDelayMs} 消耗一档并递增 attempt */
export class SteppedBackoff {
  private _attempt = 0;

  constructor(private readonly delaysMs: readonly number[] = DEFAULT_STEPPED_DELAYS_MS) {
    if (delaysMs.length === 0) {
      throw new Error("SteppedBackoff: delaysMs 不能为空");
    }
  }

  get attempt(): number {
    return this._attempt;
  }

  /** 返回当前档延迟（ms），并将 attempt +1 */
  nextDelayMs(): number {
    const idx = Math.min(this._attempt, this.delaysMs.length - 1);
    const delay = this.delaysMs[idx]!;
    this._attempt += 1;
    return delay;
  }

  /** 成功后重置 attempt，下次从首档开始 */
  reset(): void {
    this._attempt = 0;
  }
}
