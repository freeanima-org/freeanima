/**
 * Coding SPA → Habitat RPC：解析 Project World + 创建/复用会话。
 * 失败时抛错，由 UI 捕获展示；不崩窗。
 * workspace_root 与本地会话一致且创建后不可变。
 */

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import {
  resolveProjectWorldId,
  type WorldListItem,
} from "@freeanima/features/coding/domain/resolve-project-world.ts";

export type CodingSessionBootstrap = {
  conversation_id: string;
  project_world_id: number | null;
  world_created: boolean;
  platform: string;
};

function hasHabitatToken(): boolean {
  const token = window.portalShell?.remoteAuth?.token?.trim();
  return Boolean(token);
}

function asWorldList(raw: unknown): WorldListItem[] {
  if (!raw || typeof raw !== "object") return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: WorldListItem[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "number" ? r.id : Number(r.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    out.push({
      id,
      title: typeof r.title === "string" ? r.title : null,
      body: r.body,
    });
  }
  return out;
}

async function resolveOptionalWorld(opts: {
  stableKey?: string | null;
  displayName?: string | null;
}): Promise<{ project_world_id: number | null; world_created: boolean }> {
  const client = getTypedHabitatClient();
  const stableKey = opts.stableKey?.trim();
  if (!stableKey) return { project_world_id: null, world_created: false };
  const title = opts.displayName?.trim() || null;
  const resolved = await resolveProjectWorldId({
    stable_key: stableKey,
    ...(title ? { title } : {}),
    listWorlds: async () => {
      const out = await client.call("entity.worldsList", { limit: 500 });
      return asWorldList(out);
    },
    createWorld: async (input) => {
      const created = (await client.call("entity.worldsCreate", input as never)) as {
        id?: unknown;
      };
      const id = typeof created?.id === "number" ? created.id : Number(created?.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw new Error("entity.worldsCreate 未返回有效 id");
      }
      return { id };
    },
  });
  return { project_world_id: resolved.world_id, world_created: resolved.created };
}

/**
 * 确保会话存在：已有 conversationId 则复用（不改 workspace_root）；
 * 否则 conversation.create（可无 workspace_root）。
 */
export async function ensureCodingConversation(opts: {
  workspaceRoot: string | null;
  instanceId: string;
  existingConversationId?: string | null;
  stableKey?: string | null;
  displayName?: string | null;
}): Promise<CodingSessionBootstrap | null> {
  if (!hasHabitatToken()) return null;
  if (!opts.instanceId.trim()) {
    throw new Error("remote tools 尚未拿到 instance_id，稍后再建会话");
  }

  const platform = `remote:coding:${opts.instanceId.trim()}`;
  const existing = opts.existingConversationId?.trim();
  if (existing) {
    const world = await resolveOptionalWorld({
      ...(opts.stableKey != null ? { stableKey: opts.stableKey } : {}),
      ...(opts.displayName != null ? { displayName: opts.displayName } : {}),
    });
    return {
      conversation_id: existing,
      project_world_id: world.project_world_id,
      world_created: world.world_created,
      platform,
    };
  }

  const client = getTypedHabitatClient();
  const world = await resolveOptionalWorld({
    ...(opts.stableKey != null ? { stableKey: opts.stableKey } : {}),
    ...(opts.displayName != null ? { displayName: opts.displayName } : {}),
  });
  const created = await client.call("conversation.create", {
    platform,
    ...(opts.workspaceRoot ? { workspace_root: opts.workspaceRoot } : {}),
    ...(world.project_world_id != null ? { project_world_id: world.project_world_id } : {}),
    ...(opts.displayName?.trim() || opts.stableKey
      ? { title: opts.displayName?.trim() || opts.stableKey || undefined }
      : {}),
  });

  return {
    conversation_id: created.conversation_id,
    project_world_id: world.project_world_id,
    world_created: world.world_created,
    platform,
  };
}

/** @deprecated 使用 ensureCodingConversation */
export async function bootstrapCodingConversation(opts: {
  workspaceRoot: string;
  instanceId: string;
  stableKey?: string | null;
  displayName?: string | null;
}): Promise<CodingSessionBootstrap | null> {
  return ensureCodingConversation({
    workspaceRoot: opts.workspaceRoot,
    instanceId: opts.instanceId,
    ...(opts.stableKey !== undefined ? { stableKey: opts.stableKey } : {}),
    ...(opts.displayName !== undefined ? { displayName: opts.displayName } : {}),
  });
}

/** 将理解笔记写入项目 Public World（coding_note）。 */
export async function createProjectCodingNote(opts: {
  worldId: number;
  title: string;
  content?: string;
  kind?: string;
}): Promise<{ id: number }> {
  if (!hasHabitatToken()) {
    throw new Error("无 Habitat token，无法写入笔记");
  }
  const client = getTypedHabitatClient();
  const out = await client.call("coding.noteCreate", {
    world_id: opts.worldId,
    title: opts.title,
    ...(opts.content != null ? { content: opts.content } : {}),
    ...(opts.kind?.trim() ? { kind: opts.kind.trim() } : {}),
  });
  return { id: out.item.id };
}
