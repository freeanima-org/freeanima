import type { Logger } from "@freeanima/kernel-logging";
import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "./queue";
import type { EventHandler, EventTopic, PayloadOf } from "./topic";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 事件总线；handler 注册与 dispatch 在此，队列 I/O 由 adapter 注入 */
export class EventBus {
  private handlers = new Map<string, EventHandler<EventTopic<unknown>>[]>();
  private readonly log: Logger;
  private readonly queue: EventQueueAdapter;

  constructor(logger: Logger, queue: EventQueueAdapter) {
    this.log = logger.with({ component: "event-bus" });
    this.queue = queue;
  }

  on<T extends EventTopic<unknown>>(topic: T, handler: EventHandler<T>): () => void {
    const list = this.handlers.get(topic.qualifiedId) ?? [];
    const entry = handler as EventHandler<EventTopic<unknown>>;
    list.push(entry);
    this.handlers.set(topic.qualifiedId, list);
    this.log.debug("注册 event handler", { topic: topic.qualifiedId });
    return () => {
      const current = this.handlers.get(topic.qualifiedId);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (!current.length) this.handlers.delete(topic.qualifiedId);
      this.log.debug("注销 event handler", { topic: topic.qualifiedId });
    };
  }

  emit<T extends EventTopic<unknown>>(topic: T, payload: PayloadOf<T>): void {
    this.queue.enqueue(topic.qualifiedId, payload);
    this.log.debug("event 入队", { topic: topic.qualifiedId });
  }

  start(): void {
    this.log.debug("event-bus 启动");
    this.queue.start((event) => this.process(event));
  }

  stop(): void {
    this.log.debug("event-bus 停止");
    this.queue.stop();
  }

  private async process(event: StoredEvent): Promise<DispatchOutcome> {
    const list = this.handlers.get(event.topicQualifiedId) ?? [];
    if (!list.length) {
      this.log.debug("event 跳过（无 handler）", { topic: event.topicQualifiedId });
      return "ack";
    }

    this.log.debug("event 投递开始", {
      topic: event.topicQualifiedId,
      handlers: list.length,
    });

    let index = 0;
    for (const handler of list) {
      try {
        await handler(event.payload);
        this.log.debug("event handler 完成", {
          topic: event.topicQualifiedId,
          index,
        });
      } catch (err) {
        this.log.error("event handler 未处理异常", {
          topic: event.topicQualifiedId,
          index,
          err,
          message: errMessage(err),
        });
        return "retry";
      }
      index++;
    }

    this.log.debug("event 投递结束", { topic: event.topicQualifiedId });
    return "ack";
  }
}
