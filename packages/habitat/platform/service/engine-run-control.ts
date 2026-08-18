import { logComponent } from "@freeanima/habitat/platform/logging";

export class EngineRunControl {
  private shuttingDown = false;
  private inFlightCount = 0;
  private inFlightResolve: (() => void) | null = null;
  private conversationAbortControllers = new Map<string, AbortController>();
  /** 进行中的 message.send client_op_id，用于弱网重复投递时幂等短路。 */
  private inFlightClientOpIds = new Set<string>();
  /** prepare 尚未 beginEngineRun 时 interrupt 记在这里，随后 begin 立刻 aborted。 */
  private cancelNextBegin = new Set<string>();

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  startShutdown(): void {
    this.shuttingDown = true;
  }

  acquireInFlight(): void {
    this.inFlightCount++;
  }

  releaseInFlight(): void {
    this.inFlightCount--;
    if (this.inFlightCount === 0 && this.inFlightResolve != null) {
      const r = this.inFlightResolve;
      this.inFlightResolve = null;
      r();
    }
  }

  getInFlightCount(): number {
    return this.inFlightCount;
  }

  abortAll(): void {
    for (const controller of this.conversationAbortControllers.values()) {
      controller.abort();
    }
  }

  async waitForDrain(): Promise<void> {
    if (this.inFlightCount <= 0) {
      logComponent("shutdown").debug("No in-flight requests; skipping drain");
      return;
    }
    logComponent("shutdown").debug(
      `Waiting for ${this.inFlightCount} in-flight conversation/tool request(s) to flush (engine.run/runStream)…`,
      { in_flight: this.inFlightCount },
    );
    await new Promise<void>((resolve) => {
      this.inFlightResolve = resolve;
      if (this.inFlightCount <= 0) {
        this.inFlightResolve = null;
        resolve();
      }
    });
    logComponent("shutdown").debug("In-flight requests drained");
  }

  preemptSessionEngine(conversationId: string): void {
    this.conversationAbortControllers.get(conversationId)?.abort();
  }

  /** 用户停止：有进行中的 run 则 abort；尚未 begin 则取消随后一次 beginEngineRun。 */
  interruptSessionEngine(conversationId: string): void {
    const existing = this.conversationAbortControllers.get(conversationId);
    if (existing) {
      existing.abort();
      return;
    }
    this.cancelNextBegin.add(conversationId);
  }

  /** @returns false 表示同 client_op_id 已有进行中的 turn，调用方不得再跑一轮。 */
  tryAcquireClientOp(clientOpId: string): boolean {
    if (this.inFlightClientOpIds.has(clientOpId)) return false;
    this.inFlightClientOpIds.add(clientOpId);
    return true;
  }

  releaseClientOp(clientOpId: string): void {
    this.inFlightClientOpIds.delete(clientOpId);
  }

  beginEngineRun(conversationId: string): { signal: AbortSignal; controller: AbortController } {
    this.conversationAbortControllers.get(conversationId)?.abort();
    const controller = new AbortController();
    if (this.cancelNextBegin.delete(conversationId)) {
      controller.abort();
    }
    this.conversationAbortControllers.set(conversationId, controller);
    return { signal: controller.signal, controller };
  }

  endEngineRun(conversationId: string, controller: AbortController): void {
    if (this.conversationAbortControllers.get(conversationId) === controller) {
      this.conversationAbortControllers.delete(conversationId);
    }
  }
}
