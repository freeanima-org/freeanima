import type { AcpAsyncTaskSnapshot } from "../async-task.ts";
import type { AcpPromptResult } from "../prompt-result.ts";

export type AcpProgressDeliveryResult = {
  progressMessageId?: string;
};

export type AcpProgressDeliveryPort = {
  deliverProgress(
    task: AcpAsyncTaskSnapshot,
    body: string,
  ): Promise<AcpProgressDeliveryResult | void>;
  deliverResult(task: AcpAsyncTaskSnapshot, result: AcpPromptResult): Promise<void>;
  deliverError(task: AcpAsyncTaskSnapshot, message: string): Promise<void>;
};
