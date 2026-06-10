import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "../queue.ts";

/** Null queue adapter; emit dropped, never dispatch */
export class NullEventQueue implements EventQueueAdapter {
  enqueue(_topicQualifiedId: string, _payload: unknown): void {}

  start(_process: (event: StoredEvent) => Promise<DispatchOutcome>): void {}

  stop(): void {}
}
