import type { AcpAsyncTaskSnapshot } from "../async-task.ts";
import type { AcpPromptResult } from "../prompt-result.ts";

export type AcpProgressDeliveryResult = {
  progressMessageId?: string;
};

export type AcpProgressDeliverOptions = {
  /** When true, include WeChat in external progress (30s batch ticker). When false, skip WeChat. */
  weixinBatch?: boolean;
};

export type AcpProgressDeliveryPort = {
  deliverProgress(
    task: AcpAsyncTaskSnapshot,
    body: string,
    opts?: AcpProgressDeliverOptions,
  ): Promise<AcpProgressDeliveryResult | void>;
  deliverResult(task: AcpAsyncTaskSnapshot, result: AcpPromptResult): Promise<void>;
  deliverError(task: AcpAsyncTaskSnapshot, message: string): Promise<void>;
};
