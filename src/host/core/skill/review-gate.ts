import type { StoredMessage } from "@freeanima/host/core/db/domain";
import type { SkillRegistry } from "./registry.ts";
import {
  SKILL_EVOLVE_MIN_TOOL_CALLS,
  SKILL_WRITE_TOOL_NAMES,
  type SkillReviewMode,
} from "./review-constants.ts";

export type TurnToolStats = {
  toolCallCount: number;
  skillLoadCount: number;
  skillWriteCount: number;
  hadToolError: boolean;
  hadSuccessAfterError: boolean;
  loadedSkillNames: string[];
  toolTrace: { name: string; ok: boolean; summary: string }[];
};

export type SkillEvolveGateResult = {
  run: boolean;
  reason: string;
  stats: TurnToolStats;
};

function lastUserIndex(msgs: readonly StoredMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === "user") return i;
  }
  return -1;
}

function toolNameFromAssistantCalls(msg: StoredMessage): string[] {
  if (msg.role !== "assistant" || !msg.tool_calls) return [];
  return msg.tool_calls.map((tc) => tc.function.name).filter(Boolean);
}

function isToolErrorContent(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (t.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        const err = (parsed as { error?: unknown }).error;
        return typeof err === "string" && err.length > 0;
      }
    } catch {
      /* not JSON */
    }
  }
  return /^(error|failed|unknown tool|tool not loaded|tool restricted)/i.test(t);
}

function summarizeToolContent(content: string, max = 240): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

/** Analyze messages from the last user turn through the end. */
export function collectTurnToolStats(msgs: readonly StoredMessage[]): TurnToolStats {
  const start = lastUserIndex(msgs);
  const slice = start >= 0 ? msgs.slice(start) : msgs;
  const toolCallCount = slice.reduce((n, m) => n + toolNameFromAssistantCalls(m).length, 0);
  const loadedSkillNames: string[] = [];
  const toolTrace: TurnToolStats["toolTrace"] = [];
  let skillLoadCount = 0;
  let skillWriteCount = 0;
  let hadToolError = false;
  let hadSuccessAfterError = false;
  let sawError = false;

  for (const msg of slice) {
    if (msg.role === "assistant" && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        if (name === "skill_load") {
          skillLoadCount += 1;
          try {
            const args: unknown = JSON.parse(tc.function.arguments || "{}");
            if (args && typeof args === "object" && "name" in args) {
              const sn = String((args as { name?: unknown }).name ?? "").trim();
              if (sn) loadedSkillNames.push(sn);
            }
          } catch {
            /* ignore */
          }
        }
        if (SKILL_WRITE_TOOL_NAMES.has(name)) skillWriteCount += 1;
      }
    }
    if (msg.role === "tool") {
      const name = msg.name ?? "tool";
      const ok = !isToolErrorContent(msg.content);
      toolTrace.push({ name, ok, summary: summarizeToolContent(msg.content) });
      if (!ok) {
        hadToolError = true;
        sawError = true;
      } else if (sawError) {
        hadSuccessAfterError = true;
      }
    }
  }

  return {
    toolCallCount,
    skillLoadCount,
    skillWriteCount,
    hadToolError,
    hadSuccessAfterError,
    loadedSkillNames: [...new Set(loadedSkillNames)],
    toolTrace,
  };
}

export function evaluateSkillEvolveGate(
  msgs: readonly StoredMessage[],
  opts?: { minToolCalls?: number; force?: boolean },
): SkillEvolveGateResult {
  const stats = collectTurnToolStats(msgs);
  if (opts?.force) {
    return { run: true, reason: "forced", stats };
  }
  if (stats.skillWriteCount > 0) {
    return { run: false, reason: "skill already written in this turn", stats };
  }
  const min = opts?.minToolCalls ?? SKILL_EVOLVE_MIN_TOOL_CALLS;
  if (stats.toolCallCount >= min) {
    return { run: true, reason: `tool_calls>=${min} (${stats.toolCallCount})`, stats };
  }
  if (stats.skillLoadCount > 0 && stats.hadToolError) {
    return { run: true, reason: "skill_load with tool error", stats };
  }
  if (stats.hadSuccessAfterError) {
    return { run: true, reason: "recovered after tool error", stats };
  }
  return {
    run: false,
    reason: `below gate (tools=${stats.toolCallCount}, min=${min})`,
    stats,
  };
}

function excerptMessages(msgs: readonly StoredMessage[], maxMsgs = 6, maxChars = 400): string {
  const start = lastUserIndex(msgs);
  const slice = (start >= 0 ? msgs.slice(start) : msgs).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  const lines: string[] = [];
  for (const msg of slice.slice(-maxMsgs)) {
    const raw = typeof msg.content === "string" ? msg.content : "";
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    lines.push(`${msg.role}: ${text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`}`);
  }
  return lines.join("\n");
}

export function buildSkillReviewUserPrompt(input: {
  mode: SkillReviewMode;
  skills: SkillRegistry;
  msgs?: readonly StoredMessage[];
  stats?: TurnToolStats;
  note?: string;
}): string {
  const catalog = input.skills
    .listActive()
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");

  const parts: string[] = [
    `mode=${input.mode}`,
    "",
    "## Active skill catalog (name + description)",
    catalog || "(empty)",
  ];

  if (input.note?.trim()) {
    parts.push("", "## Note", input.note.trim());
  }

  if (input.mode === "evolve" && input.msgs) {
    const stats = input.stats ?? collectTurnToolStats(input.msgs);
    parts.push(
      "",
      "## Turn digest",
      `tool_calls=${stats.toolCallCount}; skill_loads=${stats.skillLoadCount}; loaded=[${stats.loadedSkillNames.join(", ")}]`,
      "",
      "### Dialogue excerpt",
      excerptMessages(input.msgs) || "(none)",
      "",
      "### Tool trace (name / ok / summary)",
      stats.toolTrace.length > 0
        ? stats.toolTrace.map((t) => `- ${t.name} ${t.ok ? "ok" : "ERR"}: ${t.summary}`).join("\n")
        : "(none)",
    );
  }

  if (input.mode === "maintain") {
    parts.push(
      "",
      "## Maintain task",
      "Review the skill catalog for duplicates, stale steps, and quality issues.",
      "Use skill_search / skill_view before patching or deleting.",
      "Prefer merge/patch over creating near-duplicate skills. noop if the library is healthy.",
    );
  } else {
    parts.push(
      "",
      "## Evolve task",
      "Decide whether this turn produced a reusable procedure worth saving.",
      "Search for similar skills before create; prefer patch when one already covers it.",
      "Use origin=evolved on skill_create. Fill allowed_tools when tools are required.",
      "noop if nothing durable should be saved.",
    );
  }

  return parts.join("\n");
}

export function buildSkillReviewSystemPrompt(mode: SkillReviewMode, curationBody: string): string {
  const body = curationBody.trim() || "(skill-curation body missing)";
  return [
    `You are FreeAnima's skill curator (mode=${mode}).`,
    "Follow the skill-curation instructions below.",
    "Prefer noop when nothing durable is worth saving or changing.",
    "Only use the provided skill_* tools.",
    "When finished, briefly state create/patch/delete actions or say noop.",
    "",
    `<skill name="skill-curation">`,
    body,
    `</skill>`,
  ].join("\n");
}
