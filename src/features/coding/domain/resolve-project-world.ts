/**
 * 按 `stable_key` 解析 / 创建 Project Public World。
 *
 * 刻意不依赖 Habitat handler 或 `host/core/db`（避免 Coding domain → habitat 跨层）。
 * SPA / Outpost 经 Habitat RPC 注入副作用：
 * - `entity.worldsList` → {@link findWorldByStableKey}
 * - 未命中则 `entity.worldsCreate`（public + `stable_key`），见 {@link buildCreatePublicProjectWorldInput}
 * - 返回的 world id 作为 `conversation.create` 的 `project_world_id`
 */

export type WorldListItem = {
  id: number;
  title?: string | null;
  body?: unknown;
};

export function extractStableKeyFromWorldBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const key = (body as Record<string, unknown>).stable_key;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed || null;
}

/** 在 worlds 列表中按 stable_key 查找（精确匹配 trim 后）。 */
export function findWorldByStableKey(
  worlds: readonly WorldListItem[],
  stableKey: string,
): WorldListItem | null {
  const want = stableKey.trim();
  if (!want) return null;
  for (const w of worlds) {
    if (extractStableKeyFromWorldBody(w.body) === want) return w;
  }
  return null;
}

/** `entity.worldsCreate` 的 public project world 载荷。 */
export function buildCreatePublicProjectWorldInput(opts: {
  stable_key: string;
  title?: string | null;
  summary?: string | null;
}): {
  title: string;
  summary: string;
  private: false;
  stable_key: string;
} {
  const stable_key = opts.stable_key.trim();
  const title = (opts.title?.trim() || stable_key).trim();
  return {
    title,
    summary: opts.summary?.trim() ?? "",
    private: false,
    stable_key,
  };
}

export type ResolveProjectWorldDeps = {
  stable_key: string;
  title?: string | null;
  summary?: string | null;
  /** 通常 `entity.worldsList` → items */
  listWorlds: () => Promise<readonly WorldListItem[]>;
  /** 通常 `entity.worldsCreate` */
  createWorld: (input: ReturnType<typeof buildCreatePublicProjectWorldInput>) => Promise<{
    id: number;
  }>;
};

/**
 * list → find；未命中则 create public world。
 * 调用方负责注入 RPC；本函数不做网络。
 */
export async function resolveProjectWorldId(
  opts: ResolveProjectWorldDeps,
): Promise<{ world_id: number; created: boolean }> {
  const stable_key = opts.stable_key.trim();
  if (!stable_key) {
    throw new Error("stable_key 不能为空");
  }
  const listed = await opts.listWorlds();
  const found = findWorldByStableKey(listed, stable_key);
  if (found) {
    return { world_id: found.id, created: false };
  }
  const created = await opts.createWorld(
    buildCreatePublicProjectWorldInput({
      stable_key,
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
    }),
  );
  return { world_id: created.id, created: true };
}
