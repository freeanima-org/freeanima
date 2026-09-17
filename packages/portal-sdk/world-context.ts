import { getTypedHabitatClient } from "./habitat-typed-client.ts";
import { getPortalSubjectIdOverride } from "./portal-subject-override.ts";
import { isRecord } from "@freeanima/shared/util";

export type ResolvedWorldContext = {
  user_subject_id: number;
  user_world_id: number;
  commons_world_id: number;
  default_chat_agent_subject_id?: number;
  default_chat_agent_world_id?: number;
  /** @deprecated */
  agent_subject_id?: number;
  /** @deprecated */
  agent_world_id?: number;
};

let cached: ResolvedWorldContext | null = null;
let inflight: Promise<ResolvedWorldContext> | null = null;

function asContext(raw: unknown): ResolvedWorldContext {
  if (!isRecord(raw)) {
    throw new Error("worlds.context: invalid response");
  }
  const user_subject_id = Number(raw.user_subject_id);
  const user_world_id = Number(raw.user_world_id);
  const commons_world_id = Number(raw.commons_world_id);
  if (
    !Number.isInteger(user_subject_id) ||
    user_subject_id <= 0 ||
    !Number.isInteger(user_world_id) ||
    user_world_id <= 0 ||
    !Number.isInteger(commons_world_id) ||
    commons_world_id <= 0
  ) {
    throw new Error("worlds.context: missing user_subject_id / world ids");
  }
  return {
    user_subject_id,
    user_world_id,
    commons_world_id,
    ...(typeof raw.default_chat_agent_subject_id === "number"
      ? { default_chat_agent_subject_id: raw.default_chat_agent_subject_id }
      : {}),
    ...(typeof raw.default_chat_agent_world_id === "number"
      ? { default_chat_agent_world_id: raw.default_chat_agent_world_id }
      : {}),
    ...(typeof raw.agent_subject_id === "number" ? { agent_subject_id: raw.agent_subject_id } : {}),
    ...(typeof raw.agent_world_id === "number" ? { agent_world_id: raw.agent_world_id } : {}),
  };
}

/** 拉取并缓存 worlds.context（模块级；产品 UI 固定用 user_subject_id）。 */
export async function loadResolvedWorldContext(): Promise<ResolvedWorldContext> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const raw = await getTypedHabitatClient().call("worlds.context", {});
    cached = asContext(raw);
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function getUserSubjectId(): Promise<number> {
  const override = getPortalSubjectIdOverride();
  if (override != null) return override;
  const ctx = await loadResolvedWorldContext();
  return ctx.user_subject_id;
}

/** 始终返回 boot 唯一 user（忽略卧室等 portal subject 覆盖）。 */
export async function getBootUserSubjectId(): Promise<number> {
  const ctx = await loadResolvedWorldContext();
  return ctx.user_subject_id;
}

/** 同步读缓存；未加载则抛错。偏好 await getUserSubjectId()。 */
export function getCachedUserSubjectId(): number {
  const override = getPortalSubjectIdOverride();
  if (override != null) return override;
  if (!cached) {
    throw new Error("ResolvedWorldContext not loaded; await loadResolvedWorldContext() first");
  }
  return cached.user_subject_id;
}

/** 同步读缓存 user subject_id，包装为 RPC payload 字段。 */
export function getCachedSubjectIdPayload(): { subject_id: number } {
  return { subject_id: getCachedUserSubjectId() };
}

/** 同步读 boot user；忽略覆盖。未加载则抛错。 */
export function getCachedBootUserSubjectId(): number {
  if (!cached) {
    throw new Error("ResolvedWorldContext not loaded; await loadResolvedWorldContext() first");
  }
  return cached.user_subject_id;
}

export function getCachedResolvedWorldContext(): ResolvedWorldContext | null {
  return cached;
}

export function resetResolvedWorldContextCacheForTest(): void {
  cached = null;
  inflight = null;
}

/** shell bridge 注入 token 后预取；无 token 时不发起 RPC（避免无 Bearer 的 worlds.context）。 */
export function prefetchResolvedWorldContextIfAuthed(): void {
  if (typeof window === "undefined") return;
  const token = window.portalShell?.remoteAuth?.token?.trim();
  if (!token) return;
  void loadResolvedWorldContext().catch(() => {
    /* 离线 / 认证失败时调用方 await 再拉 */
  });
}
