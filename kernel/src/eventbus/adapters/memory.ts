import type { EventQueueAdapter, EventQueueProcess, StoredEvent } from "../queue.ts";

/** In-process memory queue; drain after start; no persistence. Ignores {@link DispatchOutcome} (no retry). */
export class MemoryEventQueue implements EventQueueAdapter {
  private queue: StoredEvent[] = [];
  private running = false;
  private draining = false;
  private process: EventQueueProcess | null = null;

  enqueue(topicQualifiedId: string, payload: unknown): void {
    this.queue.push({ topicQualifiedId, payload });
    if (this.running) {
      void this.drain();
    }
  }

  start(process: EventQueueProcess): void {
    if (this.running) return;
    this.process = process;
    this.running = true;
    void this.drain();
  }

  stop(): void {
    this.running = false;
  }

  private async drain(): Promise<void> {
    if (this.draining || !this.running || !this.process) return;
    this.draining = true;
    const process = this.process;
    try {
      while (this.running && this.queue.length > 0) {
        const event = this.queue.shift();
        if (!event) break;
        // Memory queue always dequeues; retry/fail outcomes are not acted on.
        await process(event);
      }
    } finally {
      this.draining = false;
      if (this.running && this.queue.length > 0) {
        void this.drain();
      }
    }
  }
}
