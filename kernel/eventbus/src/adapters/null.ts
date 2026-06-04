import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "../queue";

/** 空队列适配器；emit 丢弃，永不 dispatch */
export class NullEventQueue implements EventQueueAdapter {
  enqueue(_topicQualifiedId: string, _payload: unknown): void {}

  start(_process: (event: StoredEvent) => Promise<DispatchOutcome>): void {}

  stop(): void {}
}

