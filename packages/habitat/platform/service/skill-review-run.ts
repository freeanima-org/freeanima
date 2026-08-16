import {
  SKILL_CURATION_NAME,
  SKILL_EVOLVE_MIN_TOOL_CALLS,
  SKILL_REVIEW_MAX_TURNS,
  SKILL_REVIEW_RUN_KIND_EVOLVE,
  SKILL_REVIEW_RUN_KIND_MAINTAIN,
  SKILL_REVIEW_TOOL_NAMES,
  PROFILE_SKILL_REVIEW,
  buildSkillReviewUserPrompt,
  evaluateSkillEvolveGate,
  type SkillReviewMode,
} from "@freeanima/habitat/core/skill";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { getProfileHopModel } from "@freeanima/habitat/core/config";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/habitat/core/hooks/prompt";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { resolveInvisibleCapabilityPolicy } from "./capability-policy-bind.ts";
import { toolNamesForInvisiblePolicy } from "./use-cases/cron-runner.ts";
import {
  AUTO_LLM_DEFAULT_MAX_DURATION_MS,
  runAutoLlm,
  type AutoLlmRunResult,
} from "./auto-llm-run.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type RunSkillReviewInput = {
  mode: SkillReviewMode;
  conversationId?: string;
  /** Required for evolve (unless force with empty digest). */
  msgs?: readonly StoredMessage[];
  force?: boolean;
  note?: string;
  minToolCalls?: number;
  maxLoopIterations?: number;
};

export type SkillReviewOutcome =
  | { ran: false; reason: string }
  | { ran: true; reason: string; result: AutoLlmRunResult };

function curationBody(deps: FullRuntimeDeps): string {
  return deps.engine.skills.get(SKILL_CURATION_NAME)?.content.trim() ?? "";
}

function skillReviewTaskSpec(): string {
  return `你是 FreeAnima 的技能策展（mode={{mode}}）。
遵循技能层中的 skill-curation 说明。
无明显值得固化的改动时优先 noop。
仅使用提供的 skill_* 工具。
结束后简要说明 create/patch/delete 或 noop。`;
}

/**
 * Skill evolve / maintain bypass: restricted runAutoLlm (skill_* only).
 * Writes auto_llm_runs; does not append conversation messages.
 */
export async function runSkillReview(
  deps: FullRuntimeDeps,
  input: RunSkillReviewInput,
): Promise<SkillReviewOutcome> {
  const log = deps.engine.logger.with({ component: "skill-review" });

  let gateReason = input.force ? "forced" : "maintain";
  if (input.mode === "evolve") {
    const gate = evaluateSkillEvolveGate(input.msgs ?? [], {
      ...omitUndefined({
        minToolCalls: input.minToolCalls,
        force: input.force,
      }),
    });
    if (!gate.run) {
      return { ran: false, reason: gate.reason };
    }
    gateReason = gate.reason;
  }

  const curation = curationBody(deps) || "(skill-curation body missing)";
  const skillsText = wrapPromptXml(PROMPT_XML_TAGS.skill, curation, {
    attrs: { name: SKILL_CURATION_NAME },
  });
  const userPrompt = buildSkillReviewUserPrompt({
    mode: input.mode,
    skills: deps.engine.skills,
    ...omitUndefined({
      msgs: input.msgs,
      note: input.note,
    }),
  });
  const runKind =
    input.mode === "evolve" ? SKILL_REVIEW_RUN_KIND_EVOLVE : SKILL_REVIEW_RUN_KIND_MAINTAIN;
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: runKind,
    taskSpec: skillReviewTaskSpec(),
    taskParams: { mode: input.mode },
    skillsText,
    dataParts: [{ body: userPrompt }],
  });

  const policy = resolveInvisibleCapabilityPolicy(deps.engine.catalog.toolSets, {
    caller: {
      allowed_tools: [...SKILL_REVIEW_TOOL_NAMES],
      denied_tools: [],
    },
  });
  const toolNames = toolNamesForInvisiblePolicy([...SKILL_REVIEW_TOOL_NAMES], policy);

  const model = getProfileHopModel(deps.engine.config.data, PROFILE_SKILL_REVIEW);
  const runName =
    input.mode === "evolve"
      ? `skill-evolve:${input.conversationId ?? "anon"}`
      : `skill-maintain:${input.conversationId ?? "anon"}`;

  log.info("skill review starting", {
    mode: input.mode,
    reason: gateReason,
    model,
    tool_count: toolNames.length,
  });

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind,
      subjectId: getResolvedWorldContext().agent_subject_id,
      systemPrompt,
      userMessages,
      model,
      toolNames,
      maxLoopIterations: input.maxLoopIterations ?? SKILL_REVIEW_MAX_TURNS,
      maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
      toolPolicy: policy,
      parentConversationId: input.conversationId,
      metadata: {
        gate_reason: gateReason,
        min_tool_calls: input.minToolCalls ?? SKILL_EVOLVE_MIN_TOOL_CALLS,
      },
    }),
  );

  log.info("skill review finished", {
    mode: input.mode,
    status: result.status,
    tool_calls: result.toolCalls,
    duration_ms: result.durationMs,
  });

  return { ran: true, reason: gateReason, result };
}

/** Post-turn evolve: fire-and-forget safe wrapper. */
export function scheduleSkillEvolveAfterTurn(
  deps: FullRuntimeDeps,
  conversationId: string,
  msgs: readonly StoredMessage[],
): void {
  void runSkillReview(deps, {
    mode: "evolve",
    conversationId,
    msgs,
  }).catch((err: unknown) => {
    deps.engine.logger.with({ component: "skill-review" }).warn("skill evolve failed", {
      conversation_id: conversationId,
      err: String(err instanceof Error ? err.message : err),
    });
  });
}
