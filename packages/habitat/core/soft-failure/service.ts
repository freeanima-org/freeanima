import { Service, type Context } from "cordis";

import type {
  SoftFailureNotifyFn,
  SoftFailureNotifyInput,
  SoftFailureNotifyResult,
} from "./notify.ts";

declare module "cordis" {
  interface Context {
    softFailure: SoftFailureService;
  }
}

export type SoftFailureServiceConfig = {
  notify: SoftFailureNotifyFn | null;
};

/**
 * Cordis service exposing the soft-failure Inbox notifier as `ctx.softFailure`.
 *
 * Replaces the former module-level `notifyImpl` singleton; the platform binds
 * the delivery impl (`deliverSoftFailureNotify`) at boot.
 */
export class SoftFailureService extends Service {
  private notify: SoftFailureNotifyFn | null;

  constructor(ctx: Context, config: SoftFailureServiceConfig) {
    super(ctx, "softFailure");
    this.notify = config.notify;
  }

  setNotify(notify: SoftFailureNotifyFn | null): void {
    this.notify = notify;
  }

  async deliver(input: SoftFailureNotifyInput): Promise<SoftFailureNotifyResult> {
    if (!this.notify) return "skipped";
    return this.notify(input);
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the instance and swaps the impl). */
export function mountSoftFailureService(
  ctx: Context,
  notify: SoftFailureNotifyFn | null,
): SoftFailureService {
  const existing = ctx.softFailure as SoftFailureService | undefined;
  if (existing) {
    existing.setNotify(notify);
    return existing;
  }
  return new SoftFailureService(ctx, { notify });
}
