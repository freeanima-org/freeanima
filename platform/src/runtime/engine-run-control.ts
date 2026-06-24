import { logComponent } from "@freeanima/platform/logging";

export class EngineRunControl {
  private shuttingDown = false;
  private inFlightCount = 0;
  private inFlightResolve: (() => void) | null = null;
  private conversationAbortControllers = new Map<string, AbortController>();

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
    if (this.inFlightCount === 0 && this.inFlightResolve !== null) {
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

  beginEngineRun(conversationId: string): { signal: AbortSignal; controller: AbortController } {
    this.preemptSessionEngine(conversationId);
    const controller = new AbortController();
    this.conversationAbortControllers.set(conversationId, controller);
    return { signal: controller.signal, controller };
  }

  endEngineRun(conversationId: string, controller: AbortController): void {
    if (this.conversationAbortControllers.get(conversationId) === controller) {
      this.conversationAbortControllers.delete(conversationId);
    }
  }
}
