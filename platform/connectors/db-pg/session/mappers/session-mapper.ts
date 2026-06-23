import {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionMetaSchema,
  sessionTodoStoreSchema,
  type CompressionState,
  type SessionMetaMessage,
  type SessionTodoStore,
} from "@freeanima/core/db/domain";
import { capabilityMaskSchema } from "@freeanima/core/db/schema";
import {
  sessionCachedToolsetsSchema,
  sessionFunctionsSchema,
  sessionStagedToolsetsSchema,
} from "@freeanima/core/db/schema";

import {
  acpTasksSchema,
  buildPlatformInfo,
  sessionSelectSchema,
  splitPlatformInfo,
  type SessionInsert,
} from "@freeanima/core/db/schema";

import { normalizePgTimestamp, pgJsonbOrNull, pgTextOrNull } from "../../utils/timestamp.ts";

const pgNowIso = (): string => normalizePgTimestamp(new Date());

const META_KNOWN_KEYS = new Set([
  "role",
  "model",
  "platform",
  "title",
  "cwd",
  "system_prompt",
  "compression",
  "todos",
  "awaiting_clarify",
  "acp_tasks",
  "cached_toolsets",
  "staged_toolsets",
  "functions",
  "platform_extra",
  "debug",
  "timestamp",
  "capability_mask",
  "gateway_tool_display",
]);

/** session_meta → PG insert row */
export function sessionMetaToInsert(sessionId: string, meta: SessionMetaMessage): SessionInsert {
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
  if (meta.capability_mask !== undefined) {
    extra.capability_mask = capabilityMaskSchema.parse(meta.capability_mask);
  } else {
    delete extra.capability_mask;
  }
  if (meta.gateway_tool_display !== undefined) {
    extra.gateway_tool_display = meta.gateway_tool_display;
  } else {
    delete extra.gateway_tool_display;
  }

  const cachedToolsets = sessionCachedToolsetsSchema.parse(meta.cached_toolsets ?? []);
  const stagedToolsets = sessionStagedToolsetsSchema.parse(meta.staged_toolsets ?? []);
  const todos = sessionTodoStoreSchema.parse(meta.todos ?? { items: [], next_id: 1 });
  const functions = sessionFunctionsSchema.parse(meta.functions ?? []);
  const compressionRaw = pgJsonbOrNull(meta.compression);
  const compressionParsed = compressionRaw ? compressionStateSchema.parse(compressionRaw) : null;
  const awaitingRaw = pgJsonbOrNull(meta.awaiting_clarify);
  const awaitingParsed = awaitingRaw ? awaitingClarifySchema.parse(awaitingRaw) : null;
  const acpRaw = pgJsonbOrNull(meta.acp_tasks);
  const acpParsed = acpRaw ? acpTasksSchema.parse(acpRaw) : null;

  return {
    id: sessionId,
    model: meta.model,
    title: pgTextOrNull(meta.title),
    cwd: pgTextOrNull(meta.cwd),
    systemPrompt: pgTextOrNull(meta.system_prompt),
    platformInfo: buildPlatformInfo(
      meta.platform,
      Object.keys(extra).length > 0 ? extra : undefined,
    ),
    compression: compressionParsed,
    todos,
    awaitingClarify: awaitingParsed,
    acpTasks: acpParsed,
    cachedToolsets,
    stagedToolsets,
    functions,
    debug: meta.debug === true,
    createdAt: normalizePgTimestamp(meta.timestamp),
    updatedAt: pgNowIso(),
  };
}

/** PG row → session_meta (synthetic role for existing code compatibility) */
export function rowToSessionMeta(row: unknown): SessionMetaMessage {
  const parsed = sessionSelectSchema.parse(row);
  const { platform, platform_extra } = splitPlatformInfo(parsed.platformInfo);
  const capabilityMaskRaw = platform_extra?.capability_mask;
  const capability_mask =
    capabilityMaskRaw !== undefined ? capabilityMaskSchema.parse(capabilityMaskRaw) : undefined;
  const gatewayToolDisplayRaw = platform_extra?.gateway_tool_display;
  const gateway_tool_display =
    typeof gatewayToolDisplayRaw === "string" ? gatewayToolDisplayRaw : undefined;
  const restExtra = platform_extra ? { ...platform_extra } : undefined;
  if (restExtra) delete restExtra.capability_mask;
  if (restExtra) delete restExtra.gateway_tool_display;
  const handledAt =
    typeof restExtra?.acp_tasks_handled_at === "string"
      ? restExtra.acp_tasks_handled_at
      : undefined;
  if (restExtra && "acp_tasks_handled_at" in restExtra) {
    delete restExtra.acp_tasks_handled_at;
  }
  const base = {
    role: "session_meta" as const,
    timestamp: parsed.createdAt,
    model: parsed.model,
    platform,
    title: parsed.title ?? undefined,
    cwd: parsed.cwd ?? undefined,
    system_prompt: parsed.systemPrompt ?? undefined,
    compression: parsed.compression ?? undefined,
    todos: parsed.todos,
    awaiting_clarify: parsed.awaitingClarify ?? undefined,
    acp_tasks: parsed.acpTasks ?? undefined,
    acp_tasks_handled_at: handledAt,
    cached_toolsets: parsed.cachedToolsets,
    staged_toolsets: parsed.stagedToolsets,
    functions: parsed.functions,
    platform_extra: restExtra && Object.keys(restExtra).length > 0 ? restExtra : undefined,
    capability_mask,
    gateway_tool_display,
    debug: parsed.debug,
  };
  return sessionMetaSchema.parse(base);
}

export function patchCompression(compression: CompressionState): Partial<SessionInsert> {
  return {
    compression,
    updatedAt: pgNowIso(),
  };
}

export function patchTodos(todos: SessionTodoStore): Partial<SessionInsert> {
  return {
    todos: sessionTodoStoreSchema.parse(todos),
    updatedAt: pgNowIso(),
  };
}
