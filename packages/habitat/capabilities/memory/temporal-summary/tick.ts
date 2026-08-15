import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";
import {
  getConversationTemporalDay,
  setConversationTemporalDay,
  listTemporalDayByCstDate,
} from "@freeanima/habitat/core/db/pg/temporal-summary";
import {
  isCronSession,
  listConversationIdsWithMessagesBetween,
  listMessages,
} from "@freeanima/habitat/core/db/pg/conversation";
import type { TemporalDayChunk, TemporalDayJson } from "@freeanima/habitat/core/db/schema";
import { filterRecallableMessages } from "../message-filter.ts";
import {
  cstDateString,
  cstDayStartIso,
  listClosedBucketsToday,
  peerRollRedisKey,
  peerRollSourcesFp,
  temporalBucketEndIso,
  temporalBucketStartIso,
  temporalMaterialAfterAt,
  type PeerRollSource,
} from "./buckets.ts";
import { summarizeTemporalText, TEMPORAL_SUMMARY_INSTRUCTIONS } from "./summarize.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

export type PeerRollCache = {
  getJson: <T>(key: string) => Promise<T | null>;
  setJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
};

export type TemporalSummaryTickResult = {
  ok: boolean;
  chunks_written: number;
  conversations_scanned: number;
  summary: string;
};

function lastWatermark(day: TemporalDayJson | null): { id?: string; at?: string } {
  const chunks = day?.chunks ?? [];
  const last = chunks.at(-1);
  const out: { id?: string; at?: string } = {};
  if (last?.watermark_message_id) out.id = last.watermark_message_id;
  if (last?.watermark_at) out.at = last.watermark_at;
  return out;
}

/** Messages strictly after afterAt (ISO). Exported for unit tests. */
export function filterMessagesAfterAt<T extends { t?: string }>(msgs: T[], afterAt?: string): T[] {
  const afterMs = afterAt ? Date.parse(afterAt) : Number.NaN;
  if (Number.isNaN(afterMs)) return [...msgs];
  return msgs.filter((msg) => {
    if (!msg.t) return true;
    const t = Date.parse(msg.t);
    if (Number.isNaN(t)) return true;
    return t > afterMs;
  });
}

export function formatMessagesForSummary(
  msgs: ReturnType<typeof filterRecallableMessages>,
  afterAt?: string,
): string {
  const lines: string[] = [];
  for (const msg of filterMessagesAfterAt(msgs, afterAt)) {
    lines.push(`${msg.t.slice(0, 19)} ${msg.role}: ${msg.content}`);
  }
  return lines.join("\n");
}

export async function runTemporalSummaryTick(opts: {
  config: ResolvedTemporalSummaryConfig;
  peerCache?: PeerRollCache;
  nowMs?: number;
}): Promise<TemporalSummaryTickResult> {
  if (!opts.config.enabled) {
    return {
      ok: true,
      chunks_written: 0,
      conversations_scanned: 0,
      summary: "temporal summary disabled",
    };
  }

  const nowMs = opts.nowMs ?? Date.now();
  const cst_date = cstDateString(nowMs);
  const bucket = temporalBucketStartIso(nowMs);
  const dayStartIso = cstDayStartIso(nowMs);
  const windowEnd = new Date(nowMs + 60_000).toISOString();
  // 候选：CST 当日有消息活动的会话（非 conversations.updated_at）
  const ids = await listConversationIdsWithMessagesBetween(dayStartIso, windowEnd);

  let chunks_written = 0;
  let scanned = 0;
  let softFailNotified = false;

  const notifyTickSoftFail = (error: string, detail: Record<string, unknown>) => {
    if (softFailNotified) return;
    softFailNotified = true;
    void notifySoftFailure({
      sourceRef: cstDaySourceRef("temporal_summary:tick_soft_fail", nowMs),
      title: "时间摘要 tick 软失败",
      body: ["半小时时间摘要 tick 中有步骤失败并已跳过，其余会话仍继续。", `错误：${error}`].join(
        "\n",
      ),
      payload: { kind: "temporal_summary_tick_soft_fail", error, ...detail },
      logLabel: "temporal_summary_tick",
    });
  };

  for (const conversationId of ids) {
    scanned += 1;
    if (await isCronSession(conversationId)) continue;

    const existing = await getConversationTemporalDay(conversationId);
    const day: TemporalDayJson =
      existing?.cst_date === cst_date ? existing : { cst_date, chunks: [] };
    const wm = lastWatermark(day.cst_date === cst_date ? day : null);
    const afterAt = temporalMaterialAfterAt(wm.at, dayStartIso);

    const messages = filterRecallableMessages(await listMessages(conversationId));
    const incremental = filterMessagesAfterAt(messages, afterAt);
    const material = formatMessagesForSummary(messages, afterAt);
    if (!material.trim()) continue;

    const lastIncremental = incremental.at(-1);
    let summary: string;
    try {
      summary = await summarizeTemporalText({
        instruction: TEMPORAL_SUMMARY_INSTRUCTIONS.chunk,
        material:
          day.chunks.length > 0
            ? `【已有摘要】\n${day.chunks.map((c) => c.summary).join("\n---\n")}\n\n【新增消息】\n${material}`
            : material,
        maxChars: opts.config.chunk_max_chars,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logComponent("memory").warn("temporal chunk summarize failed", {
        conversationId,
        error,
      });
      notifyTickSoftFail(error, { phase: "chunk", conversation_id: conversationId });
      continue;
    }
    if (!summary.trim()) continue;

    const chunk: TemporalDayChunk = {
      at: new Date(nowMs).toISOString(),
      bucket,
      summary: summary.trim(),
      watermark_at: lastIncremental?.t || new Date(nowMs).toISOString(),
    };
    day.chunks.push(chunk);
    await setConversationTemporalDay(conversationId, day);
    chunks_written += 1;
  }

  if (opts.peerCache) {
    await warmClosedPeerRolls({
      config: opts.config,
      peerCache: opts.peerCache,
      nowMs,
      cst_date,
      onSoftFail: notifyTickSoftFail,
    });
  }

  return {
    ok: true,
    chunks_written,
    conversations_scanned: scanned,
    summary: `temporal tick: wrote ${chunks_written} chunks (${scanned} scanned)`,
  };
}

async function warmClosedPeerRolls(opts: {
  config: ResolvedTemporalSummaryConfig;
  peerCache: PeerRollCache;
  nowMs: number;
  cst_date: string;
  onSoftFail?: (error: string, detail: Record<string, unknown>) => void;
}): Promise<void> {
  const closed = listClosedBucketsToday(opts.nowMs);
  const rows = await listTemporalDayByCstDate(opts.cst_date);
  for (const bucket of closed.slice(-4)) {
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
    const viewerIds = [...new Set(sources.map((s) => s.conversation_id))];
    for (const viewer of viewerIds) {
      const peerSources = sources.filter((s) => s.conversation_id !== viewer);
      if (peerSources.length === 0) continue;
      const fp = peerRollSourcesFp(peerSources);
      const key = peerRollRedisKey({
        prefix: opts.config.redis_key_prefix,
        cst_date: opts.cst_date,
        bucket,
        sources_fp: fp,
      });
      const hit = await opts.peerCache.getJson<{ summary: string }>(key);
      if (hit?.summary) continue;
      try {
        const summary = await summarizeTemporalText({
          instruction: TEMPORAL_SUMMARY_INSTRUCTIONS.peerRoll,
          material: peerSources
            .toSorted((a, b) => a.conversation_id.localeCompare(b.conversation_id))
            .map((s) => `[${s.conversation_id}]\n${s.summary}`)
            .join("\n\n"),
          maxChars: opts.config.peer_roll_max_chars,
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
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logComponent("memory").warn("peer roll warm failed", {
          bucket,
          error,
        });
        opts.onSoftFail?.(error, { phase: "peer_roll", bucket });
      }
    }
  }
}

export { temporalBucketEndIso };
