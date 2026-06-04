export type StoredEvent = {
  /** 持久化队列有 id；内存队列可省略 */
  id?: number;
  topicQualifiedId: string;
  payload: unknown;
};

/** dispatch 结果，由 adapter 决定如何 ack */
export type DispatchOutcome = "ack" | "retry" | "fail";

export interface EventQueueAdapter {
  enqueue(topicQualifiedId: string, payload: unknown): void;

  /**
   * 启动消费；Bus 传入 process 回调。
   * 持久化实现可在内部做 stuck 恢复与轮询。
   */
  start(process: (event: StoredEvent) => Promise<DispatchOutcome>): void;

  stop(): void;
}
