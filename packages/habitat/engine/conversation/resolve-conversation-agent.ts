import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import { getConversationMeta } from "@freeanima/habitat/core/db/pg/conversation";
import {
  isConversationMeta,
  type ConversationMetaMessage,
} from "@freeanima/habitat/core/db/domain";
import { isSubjectEnabled } from "@freeanima/habitat/core/config/resolved-world-context.ts";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg.ts";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";

export type BoundConversationAgent = {
  agent_subject_id: number;
  agent_world_id: number;
  title: string;
};

/** 校验可作为会话绑定的 agent；返回其默认私有 world */
export async function assertBindableAgentSubject(
  agentSubjectId: number,
): Promise<BoundConversationAgent> {
  const row = await getEntity(agentSubjectId);
  if (!row || row.type !== "agent") {
    throw new Error(`agent subject ${agentSubjectId} not found`);
  }
  if (!isSubjectEnabled(row.body)) {
    throw new Error(`agent subject ${agentSubjectId} is disabled`);
  }
  const agent_world_id = await resolvePrivateWorldId(agentSubjectId);
  return {
    agent_subject_id: row.id,
    agent_world_id,
    title: row.title.trim() || `Agent ${row.id}`,
  };
}

/** 创建会话时解析 agent：显式 id 或默认聊天 agent */
export async function resolveConversationAgentSubjectId(explicit?: number | null): Promise<number> {
  if (explicit != null && explicit > 0) {
    const bound = await assertBindableAgentSubject(explicit);
    return bound.agent_subject_id;
  }
  const ctx = getResolvedWorldContext();
  const bound = await assertBindableAgentSubject(ctx.default_chat_agent_subject_id);
  return bound.agent_subject_id;
}

/**
 * 从会话 meta 解析已绑定 agent + 私有 world。
 * 缺 `agent_subject_id` 时抛错（对话路径禁止回退默认聊天 agent）。
 */
export async function resolveBoundAgentFromMeta(
  meta: ConversationMetaMessage,
): Promise<BoundConversationAgent> {
  const agentId = meta.agent_subject_id;
  if (agentId == null || agentId <= 0) {
    throw new Error("conversation meta missing agent_subject_id");
  }
  return assertBindableAgentSubject(agentId);
}

/**
 * 按 conversationId 解析绑定 agent + 私有 world。
 * 会话不存在或未绑定 agent 时抛错。
 */
export async function resolveBoundAgentForConversation(
  conversationId: string,
): Promise<BoundConversationAgent> {
  const id = conversationId.trim();
  if (!id) throw new Error("conversation_id is required");
  const meta = await getConversationMeta(id);
  if (!meta || !isConversationMeta(meta)) {
    throw new Error(`conversation not found: ${id}`);
  }
  return resolveBoundAgentFromMeta(meta);
}

/** 实例内全部 enabled agent（夜间维护分桶用） */
export async function listEnabledBoundAgents(): Promise<BoundConversationAgent[]> {
  const { listEntities } = await import("@freeanima/habitat/core/db/pg/entity");
  const agents = await listEntities({ type: "agent", limit: 200 });
  const out: BoundConversationAgent[] = [];
  for (const row of agents) {
    if (!isSubjectEnabled(row.body)) continue;
    try {
      out.push(await assertBindableAgentSubject(row.id));
    } catch {
      /* skip unbindable */
    }
  }
  return out;
}
