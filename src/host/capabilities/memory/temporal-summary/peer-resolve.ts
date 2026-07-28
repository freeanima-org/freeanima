import { listTemporalDayByCstDate } from "@freeanima/host/core/db/pg/temporal-summary";
import {
  cstDateString,
  listClosedBucketsToday,
  peerRollRedisKey,
  peerRollSourcesFp,
  temporalBucketEndIso,
  type PeerRollSource,
} from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { summarizeTemporalText } from "./summarize.ts";
import type { PeerRollCache } from "./tick.ts";
import type { TimelinePeerInject } from "./timeline-inject.ts";

/** Resolve closed-bucket peer rollups for viewer conversation (one inject per bucket). */
export async function resolvePeerTimelineInjects(opts: {
  viewerConversationId: string;
  selfContent: string;
  config: ResolvedTemporalSummaryConfig;
  peerCache: PeerRollCache;
  nowMs?: number;
}): Promise<TimelinePeerInject[]> {
  if (!opts.config.enabled) return [];
  const nowMs = opts.nowMs ?? Date.now();
  const cst_date = cstDateString(nowMs);
  const closed = listClosedBucketsToday(nowMs);
  const rows = await listTemporalDayByCstDate(cst_date, {
    exclude_conversation_id: opts.viewerConversationId,
  });
  const injects: TimelinePeerInject[] = [];

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
      try {
        summary = await summarizeTemporalText({
          selfContent: opts.selfContent,
          instruction: "将多段他会话客观摘要合并为一条时段合摘要：一句级高度压缩，只留主题与结果。",
          material: sources
            .toSorted((a, b) => a.conversation_id.localeCompare(b.conversation_id))
            .map((s) => `[${s.conversation_id}]\n${s.summary}`)
            .join("\n\n"),
          maxChars: opts.config.peer_roll_max_chars,
        });
        await opts.peerCache.setJson(
          key,
          { summary, sources_fp: fp, created_at: new Date().toISOString() },
          opts.config.peer_roll_ttl_seconds,
        );
      } catch {
        summary = sources
          .toSorted((a, b) => a.conversation_id.localeCompare(b.conversation_id))
          .map((s) => s.summary)
          .join("\n")
          .slice(0, opts.config.peer_roll_max_chars);
      }
    }
    if (!summary.trim()) continue;
    injects.push({ at: temporalBucketEndIso(bucket), content: summary });
  }
  return injects;
}
