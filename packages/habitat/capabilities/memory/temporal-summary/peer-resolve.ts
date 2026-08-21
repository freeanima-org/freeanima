import { listTemporalDayByCstDate } from "@freeanima/habitat/core/db/pg/temporal-summary";
import {
  cstDateString,
  listClosedBucketsToday,
  peerRollRedisKey,
  peerRollSourcesFp,
  temporalBucketEndIso,
  type PeerRollSource,
} from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import {
  concatPeerRollSources,
  schedulePeerRollWarm,
  type PeerRollCache,
} from "./peer-roll-warm.ts";
import type { TimelinePeerInject } from "./timeline-inject.ts";

/**
 * Resolve closed-bucket peer rollups for viewer conversation (one inject per bucket).
 * 热路径只读 Redis；miss 时拼接截断并后台预热，禁止懒打 LLM。
 */
export async function resolvePeerTimelineInjects(opts: {
  viewerConversationId: string;
  config: ResolvedTemporalSummaryConfig;
  peerCache: PeerRollCache;
  nowMs?: number;
  /** 仅同 agent 其它会话；缺省则不过滤（兼容旧调用） */
  agent_subject_id?: number;
  /** 测试注入：默认 schedulePeerRollWarm */
  scheduleWarm?: typeof schedulePeerRollWarm;
}): Promise<TimelinePeerInject[]> {
  if (!opts.config.enabled) return [];
  const nowMs = opts.nowMs ?? Date.now();
  const cst_date = cstDateString(nowMs);
  const closed = listClosedBucketsToday(nowMs);
  const rows = await listTemporalDayByCstDate(cst_date, {
    exclude_conversation_id: opts.viewerConversationId,
    ...(opts.agent_subject_id != null ? { agent_subject_id: opts.agent_subject_id } : {}),
  });
  const injects: TimelinePeerInject[] = [];
  const scheduleWarm = opts.scheduleWarm ?? schedulePeerRollWarm;

  for (const bucket of closed) {
    const sources: PeerRollSource[] = [];
    for (const row of rows) {
      for (const ch of row.temporal_day.chunks) {
        if (ch.bucket !== bucket) continue;
        sources.push({
          conversation_id: row.conversation_id,
          at: ch.at,
          summary: ch.summary,
        });
      }
    }
    if (sources.length === 0) continue;
    const fp = peerRollSourcesFp(sources);
    const key = peerRollRedisKey({
      prefix: opts.config.redis_key_prefix,
      cst_date,
      bucket,
      sources_fp: fp,
    });
    let summary = (await opts.peerCache.getJson<{ summary: string }>(key))?.summary?.trim() ?? "";
    if (!summary) {
      scheduleWarm({
        cst_date,
        bucket,
        sources,
        config: opts.config,
        peerCache: opts.peerCache,
      });
      summary = concatPeerRollSources(sources, opts.config.peer_roll_max_chars);
    }
    if (!summary.trim()) continue;
    injects.push({ at: temporalBucketEndIso(bucket), content: summary });
  }
  return injects;
}
