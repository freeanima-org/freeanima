import {
  awaitingClarifySchema,
  compressionStateSchema,
  conversationMetaSchema,
  conversationTodoStoreSchema,
  type CompressionState,
  type ConversationMetaMessage,
  type ConversationTodoStore,
} from "@freeanima/habitat/core/db/domain";
import {
  conversationCachedToolsetsSchema,
  conversationFunctionsSchema,
  conversationGoalSchema,
  conversationStagedToolsetsSchema,
} from "@freeanima/habitat/core/db/schema";

import {
  acpTasksSchema,
  buildPlatformInfo,
  conversationSelectSchema,
  splitPlatformInfo,
  type ConversationInsert,
} from "@freeanima/habitat/core/db/schema";

import { pgJsonbOrNull, pgTextOrNull } from "../utils/timestamp.ts";

const pgNow = (): Date => new Date();

function metaTimestampToDate(raw: string | undefined): Date {
  if (!raw?.trim()) return pgNow();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? pgNow() : parsed;
}

const META_KNOWN_KEYS = new Set([
  "role", // legacy JSONL field; strip if present
  "model",
  "platform",
  "scenario",
  "title",
  "cwd",
  "system_prompt",
  "system_prompt_built_at",
  "compression",
  "todos",
  "awaiting_clarify",
  "acp_tasks",
  "goal",
  "cached_toolsets",
  "staged_toolsets",
  "functions",
  "platform_extra",
  "debug",
  "timestamp",
  "gateway_tool_display",
  "agent_subject_id",
]);

function parseConversationScenario(
  raw: string | null | undefined,
): "digital_human" | "coding_agent" | undefined {
  if (raw === "digital_human" || raw === "coding_agent") return raw;
  return undefined;
}

function metaBuiltAtToDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** conversation_meta → PG insert row */
export function conversationMetaToInsert(
  conversation_id: string,
  meta: ConversationMetaMessage,
): ConversationInsert {
  const passthrough: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!META_KNOWN_KEYS.has(key) && value !== undefined) {
      passthrough[key] = value;
    }
  }

  const extra: Record<string, unknown> = {
    ...(meta.platform_extra && typeof meta.platform_extra === "object" ? meta.platform_extra : {}),
    ...passthrough,
  };
  delete extra.capability_mask;
  if (meta.gateway_tool_display !== undefined) {
    extra.gateway_tool_display = meta.gateway_tool_display;
  } else {
    delete extra.gateway_tool_display;
  }

  const cached_toolsets = conversationCachedToolsetsSchema.parse(meta.cached_toolsets ?? []);
  const staged_toolsets = conversationStagedToolsetsSchema.parse(meta.staged_toolsets ?? []);
  const todos = conversationTodoStoreSchema.parse(meta.todos ?? { items: [], next_id: 1 });
  const functions = conversationFunctionsSchema.parse(meta.functions ?? []);
  const compressionRaw = pgJsonbOrNull(meta.compression);
  const compressionParsed = compressionRaw ? compressionStateSchema.parse(compressionRaw) : null;
  const awaitingRaw = pgJsonbOrNull(meta.awaiting_clarify);
  const awaitingParsed = awaitingRaw ? awaitingClarifySchema.parse(awaitingRaw) : null;
  const acpRaw = pgJsonbOrNull(meta.acp_tasks);
  const acpParsed = acpRaw ? acpTasksSchema.parse(acpRaw) : null;
  const goalRaw = pgJsonbOrNull(meta.goal);
  const goalParsed = goalRaw ? conversationGoalSchema.parse(goalRaw) : null;

  const systemPrompt = pgTextOrNull(meta.system_prompt);
  const builtAt =
    metaBuiltAtToDate(meta.system_prompt_built_at) ?? (systemPrompt != null ? pgNow() : null);

  return {
    id: conversation_id,
    model: meta.model,
    title: pgTextOrNull(meta.title),
    cwd: pgTextOrNull(meta.cwd),
    system_prompt: systemPrompt,
    system_prompt_built_at: builtAt,
    platform_info: buildPlatformInfo(
      meta.platform,
      Object.keys(extra).length > 0 ? extra : undefined,
    ),
    scenario: meta.scenario ?? null,
    agent_subject_id: (() => {
      if (meta.agent_subject_id == null) {
        throw new Error("conversation meta missing agent_subject_id");
      }
      return meta.agent_subject_id;
    })(),
    compression: compressionParsed,
    temporal_day: null,
    todos,
    awaiting_clarify: awaitingParsed,
    acp_tasks: acpParsed,
    goal: goalParsed,
    cached_toolsets,
    staged_toolsets,
    functions,
    debug: meta.debug === true,
    created_at: metaTimestampToDate(meta.timestamp),
    updated_at: pgNow(),
  };
}

/** PG conversations row → domain ConversationMetaMessage */
export function rowToConversationMeta(row: unknown): ConversationMetaMessage {
  const parsed = conversationSelectSchema.parse(row);
  const { platform, platform_extra } = splitPlatformInfo(parsed.platform_info);
  const gatewayToolDisplayRaw = platform_extra?.gateway_tool_display;
  const gateway_tool_display =
    typeof gatewayToolDisplayRaw === "string" ? gatewayToolDisplayRaw : undefined;
  const restExtra = platform_extra ? { ...platform_extra } : undefined;
  if (restExtra) delete restExtra.capability_mask; // legacy drop
  if (restExtra) delete restExtra.gateway_tool_display;
  const handledAt =
    typeof restExtra?.acp_tasks_handled_at === "string"
      ? restExtra.acp_tasks_handled_at
      : undefined;
  if (restExtra && "acp_tasks_handled_at" in restExtra) {
    delete restExtra.acp_tasks_handled_at;
  }
  const scenario = parseConversationScenario(parsed.scenario);
  const base = {
    timestamp:
      parsed.created_at instanceof Date
        ? parsed.created_at.toISOString()
        : String(parsed.created_at ?? ""),
    model: parsed.model,
    platform,
    ...(scenario ? { scenario } : {}),
    agent_subject_id: parsed.agent_subject_id,
    title: parsed.title ?? undefined,
    cwd: parsed.cwd ?? undefined,
    system_prompt: parsed.system_prompt ?? undefined,
    system_prompt_built_at:
      parsed.system_prompt_built_at instanceof Date
        ? parsed.system_prompt_built_at.toISOString()
        : parsed.system_prompt_built_at
          ? String(parsed.system_prompt_built_at)
          : undefined,
    compression: parsed.compression ?? undefined,
    todos: parsed.todos,
    awaiting_clarify: parsed.awaiting_clarify ?? undefined,
    acp_tasks: parsed.acp_tasks ?? undefined,
    goal: parsed.goal ?? undefined,
    acp_tasks_handled_at: handledAt,
    cached_toolsets: parsed.cached_toolsets,
    staged_toolsets: parsed.staged_toolsets,
    functions: parsed.functions,
    platform_extra: restExtra && Object.keys(restExtra).length > 0 ? restExtra : undefined,
    gateway_tool_display,
    debug: parsed.debug,
  };
  return conversationMetaSchema.parse(base);
}

export function patchCompression(compression: CompressionState): Partial<ConversationInsert> {
  return {
    compression,
    updated_at: pgNow(),
  };
}

export function patchTodos(todos: ConversationTodoStore): Partial<ConversationInsert> {
  return {
    todos: conversationTodoStoreSchema.parse(todos),
    updated_at: pgNow(),
  };
}
