import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";
import { memoryTypeLabel } from "@/lib/admin-status.ts";
import type { MemoryRecallHit, MemoryRecallResult } from "./memory-recall-types.ts";

function formatSemanticLines(hit: MemoryRecallHit): string[] {
  const lines = [`  ${hit.semantic_memory_id} (${hit.type}) status=${hit.status} ${hit.content}`];
  if (hit.source_conversations?.length) {
    lines.push(`  source_conversations: ${hit.source_conversations.join(", ")}`);
  }
  if (hit.observed_at || hit.occurred_at) {
    const parts: string[] = [];
    if (hit.observed_at) parts.push(`observed=${formatDisplayDateTime(hit.observed_at)}`);
    if (hit.occurred_at) parts.push(`occurred=${hit.occurred_at}`);
    lines.push(`  ${parts.join(" ")}`);
  }
  return lines;
}

function formatSessionLines(hit: MemoryRecallHit): string[] {
  const ts = hit.timestamp ? formatDisplayDateTime(hit.timestamp) : "—";
  return [`  ${hit.conversation_id} / ${hit.message_id} ${hit.role} @ ${ts}: ${hit.snippet}`];
}

function formatLimbicLines(hit: MemoryRecallHit): string[] {
  const emotion = `intensity=${hit.intensity} valence=${hit.valence ?? "—"} arousal=${hit.arousal ?? "—"}`;
  return [
    `  ${hit.limbic_memory_id} (${hit.kind}) conversation=${hit.conversation_id} ${emotion}`,
    `  ${hit.content}`,
  ];
}

function formatAutobioLines(hit: MemoryRecallHit): string[] {
  return [`  ${hit.autobiographical_memory_id} [${hit.significance}] ${hit.title}: ${hit.snippet}`];
}

export function formatMemoryRecallOutput(data: MemoryRecallResult): string {
  if (!data.results?.length) {
    return m.admin_memory_not_found({ query: data.query });
  }
  const lines = [data.summary, ""];
  for (const [idx, hit] of data.results.entries()) {
    const label = memoryTypeLabel(hit.memory_type);
    lines.push(`${idx + 1}. [${label}] score ${hit.score.toFixed(4)}`);
    if (hit.memory_type === "semantic") {
      lines.push(...formatSemanticLines(hit));
    } else if (hit.memory_type === "conversation") {
      lines.push(...formatSessionLines(hit));
    } else if (hit.memory_type === "limbic") {
      lines.push(...formatLimbicLines(hit));
    } else if (hit.memory_type === "autobiographical") {
      lines.push(...formatAutobioLines(hit));
    }
  }
  return lines.join("\n");
}
