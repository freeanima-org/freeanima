/**
 * Coding SPA → Habitat RPC：解析 Project World + 创建/复用会话。
 * 失败时抛错，由 UI 捕获展示；不崩窗。
 * workspace_root 与本地会话一致且创建后不可变。
 */

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import {
  resolveProjectWorldId,
  type WorldListItem,
} from "@freeanima/shared/coding/resolve-project-world.ts";

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
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
 * 新建 Habitat 会话：不预填 title（仓名留给分组；话题标题由首回合 LLM 生成）。
 */
export function buildCodingConversationCreateInput(opts: {
  workspaceRoot: string | null;
  instanceId: string;
  projectWorldId: number | null;
}): {
  platform: "coding";
  scenario: "coding_agent";
  outpost_app_id: "coding";
  outpost_instance_id: string;
  workspace_root?: string;
  project_world_id?: number;
} {
  const instanceId = opts.instanceId.trim();
  return {
    platform: "coding",
    scenario: "coding_agent",
    outpost_app_id: "coding",
    outpost_instance_id: instanceId,
    ...(opts.workspaceRoot ? { workspace_root: opts.workspaceRoot } : {}),
    ...(opts.projectWorldId != null ? { project_world_id: opts.projectWorldId } : {}),
  };
}

export function titleFromCodingConversationList(
  conversations: Array<{ conversation_id: string; title?: string | undefined }>,
  conversationId: string,
): string | null {
  const row = conversations.find((c) => c.conversation_id === conversationId);
  const title = row?.title?.trim();
  return title || null;
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

  const platform = "coding";
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
  const created = await client.call(
    "conversation.create",
    buildCodingConversationCreateInput({
      workspaceRoot: opts.workspaceRoot,
      instanceId: opts.instanceId,
      projectWorldId: world.project_world_id,
    }),
  );

  return {
    conversation_id: created.conversation_id,
    project_world_id: world.project_world_id,
    world_created: world.world_created,
    platform,
  };
}

export async function fetchCodingConversationTitle(conversationId: string): Promise<string | null> {
  if (!hasHabitatToken()) return null;
  const id = conversationId.trim();
  if (!id) return null;
  const client = getTypedHabitatClient();
  const out = await client.call("conversation.list", {
    platform: "coding",
    limit: 500,
  });
  return titleFromCodingConversationList(out.conversations, id);
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
