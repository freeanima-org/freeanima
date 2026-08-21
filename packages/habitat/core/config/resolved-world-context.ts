import { subjectConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";

/**
 * Boot 后内存上下文。
 * `default_chat_agent_*` 仅供 Chat/Coding 新建会话预选与设置展示；
 * **禁止**作为工具/仓库缺省 world 回退。
 *
 * 无 PG：`resolvePrivateWorldId` 在 `world-context-pg.ts`。
 */
export type ResolvedWorldContext = {
  user_subject_id: number;
  user_world_id: number;
  commons_world_id: number;
  default_chat_agent_subject_id: number;
  default_chat_agent_world_id: number;
  /**
   * @deprecated 等于 default_chat_agent_subject_id；仅兼容旧读路径，勿作工具回退。
   */
  agent_subject_id: number;
  /**
   * @deprecated 等于 default_chat_agent_world_id；仅兼容旧读路径，勿作工具回退。
   */
  agent_world_id: number;
};

/** @deprecated 新代码用 subject_id；仅 user 仍可经此解析 */
export type SubjectKind = "user" | "agent";

let resolvedWorldContext: ResolvedWorldContext | null = null;

export function bindResolvedWorldContext(ctx: ResolvedWorldContext): void {
  resolvedWorldContext = ctx;
}

export function getResolvedWorldContext(): ResolvedWorldContext {
  if (!resolvedWorldContext) {
    throw new Error(
      "ResolvedWorldContext not bound; ensure resolveAndBindWorldContext() ran at boot",
    );
  }
  return resolvedWorldContext;
}

/** Bootstrap / early createEntity may run before world context is bound. */
export function tryGetResolvedWorldContext(): ResolvedWorldContext | null {
  return resolvedWorldContext;
}

export function resetResolvedWorldContextForTest(): void {
  resolvedWorldContext = null;
}

export function isSubjectEnabled(body: unknown): boolean {
  const parsed = subjectConfigBodySchema.safeParse(body ?? {});
  if (!parsed.success) return true;
  return parsed.data.enabled !== false;
}

/**
 * @deprecated 仅支持 kind=user。agent 必须 resolvePrivateWorldId(subject_id) 或会话 ALS。
 */
export function resolveSubjectWorldId(kind: SubjectKind): number {
  const ctx = getResolvedWorldContext();
  if (kind === "user") return ctx.user_world_id;
  throw new Error(
    'resolveSubjectWorldId("agent") removed; pass subject_id and use resolvePrivateWorldId, or omit world in conversation tool context',
  );
}
