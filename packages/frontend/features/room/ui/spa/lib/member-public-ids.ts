import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

/** 从 subject/entity id 解析 public_id。 */
export async function publicIdFromEntityId(entityId: number): Promise<string | null> {
  const data = await getTypedHabitatClient().call("entity.get", { id: entityId });
  const body = data.item.body as { public_id?: string };
  return body.public_id?.trim() || null;
}

export async function publicIdsFromEntityIds(entityIds: number[]): Promise<string[]> {
  const unique = [...new Set(entityIds.filter((id) => Number.isInteger(id) && id > 0))];
  const out: string[] = [];
  for (const id of unique) {
    const pid = await publicIdFromEntityId(id);
    if (pid) out.push(pid);
  }
  return out;
}

/** 正文中的 `[[anima:N]]` → entity id。 */
export function extractAnimaEntityIds(text: string): number[] {
  const ids: number[] = [];
  const re = /\[\[anima:(\d+)\]\]/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  return [...new Set(ids)];
}
