import { CST_OFFSET_MS } from "@freeanima/storage-util";
import type {
  LimbicMemoryRow,
  SemanticMemoryRow,
  SessionStorePort,
} from "@freeanima/storage-repos";

import { filterRecallableMessages } from "../message-filter.ts";
import { getLimbicMemoryStore } from "../limbic-port.ts";
import { getSemanticMemoryStore } from "../semantic-port.ts";

export type LightSleepDayRange = {
  day: string;
  fromIso: string;
  toIso: string;
};

/** CST calendar-day boundary [fromIso, toIso) */
export function cstDayRange(day?: string): LightSleepDayRange {
  const now = new Date(Date.now() + CST_OFFSET_MS);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let d = now.getUTCDate();

  if (day) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]) - 1;
      d = Number(match[3]);
    }
  } else {
    // At 02:00 runtime, default to the CST calendar day that just ended
    const prev = new Date(Date.UTC(y, m, d) - 24 * 60 * 60 * 1000);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    d = prev.getUTCDate();
  }

  const dayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fromIso = `${dayStr}T00:00:00+08:00`;
  const next = new Date(Date.UTC(y, m, d + 1));
  const toIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}T00:00:00+08:00`;
  return { day: dayStr, fromIso, toIso };
}

export type LightSleepSessionBlock = {
  sessionId: string;
  title: string;
  platform: string;
  updatedAt: string;
  text: string;
};

const MAX_DIALOGUE_CHARS = 120_000;

function roleLabel(role: string): string {
  return role === "user" ? "User" : "Agent";
}

export async function collectSessionBlocks(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<LightSleepSessionBlock[]> {
  const blocks: LightSleepSessionBlock[] = [];
  for (const sessionId of sessionIds) {
    const meta = await sessionStore.getSessionMetaLite(sessionId);
    if (!meta || meta.role !== "session_meta") continue;
    const messages = filterRecallableMessages(await sessionStore.listMessages(sessionId));
    if (!messages.length) continue;

    const lines = [`## Session ${sessionId}`];
    const title = meta.title?.trim();
    const platform = meta.platform ?? "unknown";
    const updatedAt = meta.timestamp ?? "";
    lines.push(
      `(platform=${platform}${title ? `, title=${title}` : ""}, updated ${updatedAt.slice(0, 19)})`,
    );
    lines.push("");
    for (const msg of messages) {
      const ts = msg.t.slice(0, 19) || "?";
      lines.push(`${ts} ${roleLabel(msg.role)}: ${msg.content}`);
    }

    blocks.push({
      sessionId,
      title: title ?? "",
      platform,
      updatedAt,
      text: lines.join("\n"),
    });
  }
  return blocks;
}

export function formatDialogueMessage(blocks: LightSleepSessionBlock[]): {
  text: string;
  truncatedSessions: number;
} {
  if (!blocks.length) {
    return { text: "(No valid dialogue for this day)", truncatedSessions: 0 };
  }

  let total = 0;
  const selected: LightSleepSessionBlock[] = [];
  for (const block of blocks) {
    const next = total + block.text.length + 2;
    if (next > MAX_DIALOGUE_CHARS && selected.length > 0) break;
    selected.push(block);
    total = next;
  }

  const truncatedSessions = blocks.length - selected.length;
  const header = `# Today's dialogue (${selected.length} session(s))`;
  let body = selected.map((b) => b.text).join("\n\n");
  if (truncatedSessions > 0) {
    body += `\n\n[Truncated ${truncatedSessions} session(s) — context budget exceeded]`;
  }
  return { text: `${header}\n\n${body}`, truncatedSessions };
}

export function formatExistingMemoriesMessage(rows: SemanticMemoryRow[]): string {
  if (!rows.length) return "(No existing active memories overlapping these sessions)";
  const lines = [`# Related existing memories (${rows.length}, pre-filtered by source_sessions)`];
  for (const row of rows) {
    const sources = row.source_sessions.length > 0 ? `[${row.source_sessions.join(", ")}]` : "[]";
    const observed = row.observed_at?.slice(0, 19) ?? "?";
    const occurred = row.occurred_at?.trim() ? ` occurred=${row.occurred_at}` : "";
    lines.push(
      `[${row.id}] (${row.type}) sources=${sources} observed=${observed}${occurred}${row.pinned ? " 📌" : ""}`,
    );
    lines.push(row.content);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export const LIGHT_SLEEP_INSTRUCTION_MESSAGE = `# Extraction instructions

You are a digital life running in Free Anima. From "Today's dialogue" above, extract facts worth remembering long-term (first person), and decide create / update / deprecate against "Related existing memories".

## Memory types
- world / experience / opinion / observation / preference / procedural / imprint

## Dedup rules (local)
- Compare **only** against existing memories whose source_sessions overlap
- Existing is more accurate → skip or update
- New fact supplements existing → update
- Existing no longer applies → memory_semantic_deprecate
- Brand new → memory_semantic_create

## Tools

### memory_semantic_create
Explicit create. Required: content; recommended: type, source_sessions (from dialogue sessions).
- **observed_at**: message time when the fact was **first mentioned** (ISO8601, from line timestamp above)
- **occurred_at**: when the fact **described in content** happened (may be fuzzy, e.g. "spring 2025", "last week"); distinct from observed_at

### memory_semantic_update (overwrite fields)
**Only fields you pass are changed; omitted fields stay as-is.**
- To change content/type/pinned/observed_at/occurred_at/status → pass the field
- To **clear** source_sessions → pass \`source_sessions: []\` explicitly
- Omit source_sessions → unchanged

### memory_semantic_deprecate
Soft deprecate (status=deprecated), keep history.

Call tools directly to persist; no JSON summary output needed.`;

export const LIMBIC_INSTRUCTION = `# Affective extraction

You are a digital life running in Free Anima. From "Today's dialogue" above, decide whether any emotional experience is worth recording; check "Existing limbic memories" to avoid duplicates.

## Restraint
- Mild mood swings, intensity < 0.3 → **do not** call memory_limbic_create
- No clear emotional signal → reply "Skipped this round: no emotion worth recording"
- Do not re-record similar feelings for the same session

## Tool: memory_limbic_create
- kind: session_mood (overall mood) | turning_point (emotional turn) | spike (intense moment)
- content: first person "I feel…"
- valence: -1.0 (negative) to 1.0 (positive); arousal: 0.0 to 1.0
- intensity: write only if ≥ 0.3; optional semantic_memory_ids and session_id

Call the tool directly; no JSON summary output needed.`;

export async function collectLimbicMemoriesForSessions(
  sessionIds: string[],
): Promise<LimbicMemoryRow[]> {
  const store = getLimbicMemoryStore();
  const byId = new Map<string, LimbicMemoryRow>();
  for (const sessionId of sessionIds) {
    const rows = await store.listBySession(sessionId);
    for (const row of rows) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

export function formatLimbicMemoriesMessage(rows: LimbicMemoryRow[]): string {
  if (!rows.length) {
    return "(No existing limbic memories overlapping these sessions)";
  }
  const lines = [`# Existing limbic memories (${rows.length})`];
  for (const row of rows) {
    const semanticIds =
      row.semantic_memory_ids.length > 0 ? `[${row.semantic_memory_ids.join(", ")}]` : "[]";
    lines.push(
      `[${row.id}] (${row.kind}) session=${row.session_id} intensity=${row.intensity} semantic=${semanticIds}`,
    );
    lines.push(row.content);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export async function buildLightSleepUserMessages(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<string[]> {
  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const related = await getSemanticMemoryStore().listBySourceSessions(sessionIds, {
    status: "active",
  });
  return [dialogue.text, formatExistingMemoriesMessage(related), LIGHT_SLEEP_INSTRUCTION_MESSAGE];
}

export async function buildLimbicUserMessages(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<string[]> {
  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const related = await collectLimbicMemoriesForSessions(sessionIds);
  return [dialogue.text, formatLimbicMemoriesMessage(related), LIMBIC_INSTRUCTION];
}
