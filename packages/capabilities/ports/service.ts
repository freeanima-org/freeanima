import { Service, type Context } from "cordis";

import { ensureRootContext } from "@freeanima/kernel";
import type { Config } from "@freeanima/core/config";

import type { OnConversationCloseBeforeNewFn } from "./conversation-close.ts";
import type { StatsReportFn } from "./conversation-stats.ts";
import type { CronNotifyFn, InprocessBuiltinFailureNotifyFn } from "./cron-notify.ts";
import type { RunCronEngineTurnFn } from "./cron-use-cases.ts";
import type { RunSimpleTurnFn } from "./turn-lifecycle.ts";

declare module "cordis" {
  interface Context {
    platformPorts: PlatformPortsService;
  }
}

/**
 * Cordis service (`ctx.platformPorts`) holding the composition-root ports that
 * capabilities and features call back into (turn runner, stats, cron hooks,
 * home channel).
 *
 * Replaces the seven module-level register/unregister registries with one
 * service on the root context: the ports are torn down with the context and no
 * longer leak across tests.
 */
export class PlatformPortsService extends Service {
  runSimpleTurn: RunSimpleTurnFn | null = null;
  statsReport: StatsReportFn | null = null;
  closeBeforeNew: OnConversationCloseBeforeNewFn | null = null;
  runCronEngineTurn: RunCronEngineTurnFn | null = null;
  cronNotify: CronNotifyFn | null = null;
  inprocessFailureNotify: InprocessBuiltinFailureNotifyFn | null = null;
  homeChannelConfig: Config | null = null;
  patchRuntimeConfigSection:
    | ((section: string, patch: Record<string, unknown>) => Promise<void>)
    | null = null;
  /** RPC 会话 pump 控制器（ws-server 创建，特性路由取用） */
  sessionPumps: Map<string, AbortController> | null = null;
  /** 任务提醒 sleep-until-next 调度（由 server 组合根注入实现） */
  startTaskReminders: (() => void) | null = null;
  stopTaskReminders: (() => void) | null = null;
  rescheduleTaskReminders: (() => void) | null = null;

  constructor(ctx: Context) {
    super(ctx, "platformPorts");
  }
}

function asService(value: unknown): PlatformPortsService | null {
  return value instanceof PlatformPortsService ? value : null;
}

/** The root-context platform ports service (mounted on first use, idempotent). */
export function platformPorts(): PlatformPortsService {
  const ctx = ensureRootContext();
  const existing = asService(ctx.reflect.get("platformPorts", false));
  if (existing) return existing;
  return new PlatformPortsService(ctx);
}
