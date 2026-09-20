import { Context, Service } from "cordis";

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
 * 端口状态由本模块持有：内部消费者经 {@link platformPorts} 取用，不再查进程根
 * context；需要 ctx 的消费方仍可用 `ctx.platformPorts`。
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

let current: PlatformPortsService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function platformPorts(): PlatformPortsService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new PlatformPortsService(ownedCtx);
  }
  return current;
}

/** Test teardown。 */
export function resetPlatformPortsForTest(): void {
  current = null;
  ownedCtx = null;
}
