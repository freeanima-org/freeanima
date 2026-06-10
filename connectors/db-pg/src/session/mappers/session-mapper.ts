import {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionMetaSchema,
  sessionTodoStoreSchema,
  type CompressionState,
  type SessionMetaMessage,
  type SessionTodoStore,
} from "@freeanima/engine-db/domain";
import { capabilityMaskSchema } from "@freeanima/engine-db/schema";
import {
  sessionFunctionsSchema,
  sessionLoadedToolsSchema,
  sessionToolsSchema,
} from "@freeanima/engine-db/schema";

import {
  acpSessionsSchema,
  buildPlatformInfo,
  sessionSelectSchema,
  splitPlatformInfo,
  type SessionInsert,
} from "@freeanima/engine-db/schema";

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
  "acp_sessions",
  "tools",
  "loaded_tools",
  "functions",
  "platform_extra",
  "debug",
  "timestamp",
  "capability_mask",
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

  const tools = sessionToolsSchema.parse(meta.tools ?? []);
  const loadedTools = sessionLoadedToolsSchema.parse(meta.loaded_tools ?? []);
  const todos = sessionTodoStoreSchema.parse(meta.todos ?? { items: [], next_id: 1 });
  const functions = sessionFunctionsSchema.parse(meta.functions ?? []);
  const compressionRaw = pgJsonbOrNull(meta.compression);
  const compressionParsed = compressionRaw ? compressionStateSchema.parse(compressionRaw) : null;
  const awaitingRaw = pgJsonbOrNull(meta.awaiting_clarify);
  const awaitingParsed = awaitingRaw ? awaitingClarifySchema.parse(awaitingRaw) : null;
  const acpRaw = pgJsonbOrNull(meta.acp_sessions);
  const acpParsed = acpRaw ? acpSessionsSchema.parse(acpRaw) : null;

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
    acpSessions: acpParsed,
    tools,
    loadedTools,
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
  const restExtra = platform_extra ? { ...platform_extra } : undefined;
  if (restExtra) delete restExtra.capability_mask;
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
    acp_sessions: parsed.acpSessions ?? undefined,
    tools: parsed.tools,
    loaded_tools: parsed.loadedTools,
    functions: parsed.functions,
    platform_extra: restExtra && Object.keys(restExtra).length > 0 ? restExtra : undefined,
    capability_mask,
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
