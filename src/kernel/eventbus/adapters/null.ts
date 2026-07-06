import type { EventQueueAdapter, EventQueueProcess } from "../queue.ts";

/** Null queue adapter; emit dropped, never dispatch */
export class NullEventQueue implements EventQueueAdapter {
  enqueue(_topicQualifiedId: string, _payload: unknown): void {
    return;
  }

  start(_process: EventQueueProcess): void {
    return;
  }

  stop(): void {
    return;
  }
}
