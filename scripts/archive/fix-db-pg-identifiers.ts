/** Fix identifier names in db-pg after param rename (function args were over-renamed). */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "src/host/core/db/pg");

const ID_RENAMES: [string, string][] = [
  ["sourceConversationIds", "source_conversation_ids"],
  ["sourceConversations", "source_conversations"],
  ["semanticMemoryIds", "semantic_memory_ids"],
  ["semanticMemoryId", "semantic_memory_id"],
  ["primaryComponent", "primary_component"],
  ["episodicSnippets", "episodic_snippets"],
  ["sourceLimbicIds", "source_limbic_ids"],
  ["conversationId", "conversation_id"],
  ["contentEmbedding", "content_embedding"],
  ["referenceCount", "reference_count"],
  ["awaitingClarify", "awaiting_clarify"],
  ["cachedToolsets", "cached_toolsets"],
  ["stagedToolsets", "staged_toolsets"],
  ["modelProvider", "model_provider"],
  ["outputText", "output_text"],
  ["inputSummary", "input_summary"],
  ["recipientKind", "recipient_kind"],
  ["recipientId", "recipient_id"],
  ["skippedReason", "skipped_reason"],
  ["sourceSegment", "source_segment"],
  ["systemPrompt", "system_prompt"],
  ["platformInfo", "platform_info"],
  ["ftsSegmented", "fts_segmented"],
  ["searchEmbedding", "search_embedding"],
  ["contentFts", "content_fts"],
  ["searchFts", "search_fts"],
  ["sourceFacts", "source_facts"],
  ["periodStart", "period_start"],
  ["periodEnd", "period_end"],
  ["observedAt", "observed_at"],
  ["occurredAt", "occurred_at"],
  ["instanceId", "instance_id"],
  ["lastOutputRef", "last_output_ref"],
  ["lastRunAt", "last_run_at"],
  ["timeoutSec", "timeout_sec"],
  ["contextFrom", "context_from"],
  ["modelName", "model_name"],
  ["finishedAt", "finished_at"],
  ["startedAt", "started_at"],
  ["durationMs", "duration_ms"],
  ["pipelineId", "pipeline_id"],
  ["sourceKind", "source_kind"],
  ["sourceRef", "source_ref"],
  ["messageId", "message_id"],
  ["archivedAt", "archived_at"],
  ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
  ["updatedBy", "updated_by"],
  ["blockKey", "block_key"],
  ["worldId", "world_id"],
  ["dreamDay", "dream_day"],
  ["runCount", "run_count"],
  ["noAgent", "no_agent"],
  ["readAt", "read_at"],
  ["httpUrl", "http_url"],
  ["appId", "app_id"],
  ["runName", "run_name"],
  ["runKind", "run_kind"],
  ["runId", "run_id"],
  ["stepId", "step_id"],
  ["jobId", "job_id"],
  ["acpTasks", "acp_tasks"],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function transform(content: string): string {
  let out = content;
  for (const [from, to] of ID_RENAMES) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const before = readFileSync(file, "utf8");
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`Fixed identifiers in ${changed} files`);
