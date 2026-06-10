export type StoredEvent = {
  /** Persisted queue has id; memory queue may omit */
  id?: number;
  topicQualifiedId: string;
  payload: unknown;
};

/** dispatch result; adapter decides how to ack */
export type DispatchOutcome = "ack" | "retry" | "fail";

export interface EventQueueAdapter {
  enqueue(topicQualifiedId: string, payload: unknown): void;

  /**
   * Start consumption; Bus passes process callback.
   * Persisted impl may do stuck recovery and polling internally.
   */
  start(process: (event: StoredEvent) => Promise<DispatchOutcome>): void;

  stop(): void;
}
