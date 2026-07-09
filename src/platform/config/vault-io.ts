import { resolveAgentVaultSecret } from "@freeanima/platform/connectors/vault";
import { resolveVaultWorldId } from "@freeanima/features/vault/domain/vault-world";

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
    const worldId = resolveVaultWorldId("agent");
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
