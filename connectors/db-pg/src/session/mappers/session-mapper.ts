import {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionMetaSchema,
  sessionTodoStoreSchema,
  type CompressionState,
  type SessionMetaMessage,
  type SessionTodoStore,
} from "@freeanima/engine-db/domain";
import { z } from "zod";

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
  "functions",
  "platform_extra",
  "debug",
  "timestamp",
]);

/** session_meta → PG insert 行 */
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

  const tools = z.array(z.string()).parse(meta.tools ?? []);
  const todos = sessionTodoStoreSchema.parse(meta.todos ?? { items: [], next_id: 1 });
  const functions = z.array(z.string()).parse(meta.functions ?? []);
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
    functions,
    debug: meta.debug === true,
    createdAt: normalizePgTimestamp(meta.timestamp),
    updatedAt: pgNowIso(),
  };
}

/** PG 行 → session_meta（合成 role 供现有代码兼容） */
export function rowToSessionMeta(row: unknown): SessionMetaMessage {
  const parsed = sessionSelectSchema.parse(row);
  const { platform, platform_extra } = splitPlatformInfo(parsed.platformInfo);
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
    functions: parsed.functions,
    platform_extra,
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
