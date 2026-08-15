import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";

import type { SysRollKind } from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { regenerateTemporalSystemRoll } from "./system-rolls.ts";
import type { PeerRollCache } from "./tick.ts";

export type TemporalSystemRollWarmRegenerate = typeof regenerateTemporalSystemRoll;

/**
 * 记忆维护写完日/月/年实体后，后台预热 sys_roll（不挡主流程）。
 * 拼装路径只读缓存，禁止在用户 RPC 路径懒打 LLM。
 */
export function scheduleTemporalSystemRollWarm(opts: {
  kinds: readonly SysRollKind[];
  config: ResolvedTemporalSummaryConfig;
  selfContent: string;
  peerCache?: PeerRollCache;
  nowMs?: number;
  /** 测试注入 */
  regenerateOne?: TemporalSystemRollWarmRegenerate;
}): void {
  if (!opts.config.enabled || opts.kinds.length === 0) return;
  const kinds = [...opts.kinds];
  const regenerate = opts.regenerateOne ?? regenerateTemporalSystemRoll;
  void (async () => {
    for (const kind of kinds) {
      try {
        await regenerate({
          kind,
          config: opts.config,
          selfContent: opts.selfContent,
          ...(opts.peerCache ? { peerCache: opts.peerCache } : {}),
          ...(opts.nowMs !== undefined ? { nowMs: opts.nowMs } : {}),
        });
      } catch (e) {
        logComponent("memory").warn("sys_roll warm failed", {
          kind,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  })();
}
