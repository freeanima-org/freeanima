import { resolveAgentVaultSecret } from "@freeanima/habitat/capabilities/connectors/vault";
import { resolveVaultWorldId } from "@freeanima/features/vault/domain/vault-world";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config";

const cache = new Map<string, string | Error>();

function cacheKey(itemId: number, field: string): string {
  return `${itemId}:${field}`;
}

export async function resolveVaultField(itemId: number, field: string): Promise<string> {
  const key = cacheKey(itemId, field);
  const hit = cache.get(key);
  if (hit !== undefined) {
    if (hit instanceof Error) throw hit;
    return hit;
  }
  try {
    const ctx = getResolvedWorldContext();
    // 配置密钥解析：vault() 落在默认聊天 Anima 的私有 world（配置期宿主，非 LLM 行动主体回退）
    const worldId = await resolveVaultWorldId(ctx.default_chat_agent_subject_id);
    const value = await resolveAgentVaultSecret(worldId, itemId, field);
    cache.set(key, value);
    return value;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    cache.set(key, err);
    throw err;
  }
}

export function clearVaultFieldCache(): void {
  cache.clear();
}
