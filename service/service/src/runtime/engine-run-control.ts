import { logComponent } from "@freeanima/service-logging";

export class EngineRunControl {
  private shuttingDown = false;
  private inFlightCount = 0;
  private inFlightResolve: (() => void) | null = null;
  private sessionAbortControllers = new Map<string, AbortController>();

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
    for (const controller of this.sessionAbortControllers.values()) {
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

  preemptSessionEngine(sessionId: string): void {
    this.sessionAbortControllers.get(sessionId)?.abort();
  }

  beginEngineRun(sessionId: string): { signal: AbortSignal; controller: AbortController } {
    this.preemptSessionEngine(sessionId);
    const controller = new AbortController();
    this.sessionAbortControllers.set(sessionId, controller);
    return { signal: controller.signal, controller };
  }

  endEngineRun(sessionId: string, controller: AbortController): void {
    if (this.sessionAbortControllers.get(sessionId) === controller) {
      this.sessionAbortControllers.delete(sessionId);
    }
  }
}
