import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "../queue.ts";

/** 进程内内存队列；start 后 drain，无持久化与重试 */
export class MemoryEventQueue implements EventQueueAdapter {
  private queue: StoredEvent[] = [];
  private running = false;
  private draining = false;
  private process: ((event: StoredEvent) => Promise<DispatchOutcome>) | null = null;

  enqueue(topicQualifiedId: string, payload: unknown): void {
    this.queue.push({ topicQualifiedId, payload });
    if (this.running) {
      void this.drain();
    }
  }

  start(process: (event: StoredEvent) => Promise<DispatchOutcome>): void {
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
