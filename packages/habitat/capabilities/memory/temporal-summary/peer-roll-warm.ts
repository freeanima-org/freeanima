import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";

import { peerRollRedisKey, peerRollSourcesFp, type PeerRollSource } from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import {
  summarizeTemporalText,
  temporalSummaryHardCap,
  TEMPORAL_SUMMARY_INSTRUCTIONS,
} from "./summarize.ts";

export type PeerRollCache = {
  getJson: <T>(key: string) => Promise<T | null>;
  setJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
};

export type WarmPeerRollOpts = {
  cst_date: string;
  bucket: string;
  sources: readonly PeerRollSource[];
  config: ResolvedTemporalSummaryConfig;
  peerCache: PeerRollCache;
  agent_subject_id: number;
  /** 测试注入 */
  summarize?: typeof summarizeTemporalText;
};

/** 同伴源拼接截断（热路径降级 / LLM 失败兜底）。 */
export function concatPeerRollSources(
  sources: readonly PeerRollSource[],
  maxChars: number,
): string {
  return sources
    .toSorted((a, b) => a.conversation_id.localeCompare(b.conversation_id))
    .map((s) => s.summary)
    .join("\n")
    .slice(0, temporalSummaryHardCap(maxChars));
}

/** 单桶 LLM 合并并写入 Redis；已命中则跳过。 */
export async function warmPeerRoll(opts: WarmPeerRollOpts): Promise<boolean> {
  if (!opts.config.enabled || opts.sources.length === 0) return false;
  const fp = peerRollSourcesFp([...opts.sources]);
  const key = peerRollRedisKey({
    prefix: opts.config.redis_key_prefix,
    cst_date: opts.cst_date,
    bucket: opts.bucket,
    sources_fp: fp,
  });
  const hit = await opts.peerCache.getJson<{ summary: string }>(key);
  if (hit?.summary?.trim()) return false;

  const summarize = opts.summarize ?? summarizeTemporalText;
  const summary = await summarize({
    instruction: TEMPORAL_SUMMARY_INSTRUCTIONS.peerRoll,
    material: opts.sources
      .toSorted((a, b) => a.conversation_id.localeCompare(b.conversation_id))
      .map((s) => `[${s.conversation_id}]\n${s.summary}`)
      .join("\n\n"),
    maxChars: opts.config.peer_roll_max_chars,
    agent_subject_id: opts.agent_subject_id,
  });
  await opts.peerCache.setJson(
    key,
    {
      summary,
      sources_fp: fp,
      created_at: new Date().toISOString(),
    },
    opts.config.peer_roll_ttl_seconds,
  );
  return true;
}

/**
 * 对话热路径 miss 后后台预热 peer_roll（不挡主流程）。
 * 注入路径只读缓存 / 拼接降级，禁止在 beforeLlmCall 懒打 LLM。
 */
export function schedulePeerRollWarm(opts: WarmPeerRollOpts): void {
  if (!opts.config.enabled || opts.sources.length === 0) return;
  void (async () => {
    try {
      await warmPeerRoll(opts);
    } catch (e) {
      logComponent("memory").warn("peer roll warm failed", {
        bucket: opts.bucket,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();
}
