import { entityDocKey, messageDocKey } from "@freeanima/habitat/core/util";

import type { SearchResource } from "./types.ts";

export function searchDocKey(resource: SearchResource, sourceId: string | number): string {
  if (resource === "entity") return entityDocKey(Number(sourceId));
  return messageDocKey(String(sourceId));
}

export function parseSearchDocKey(
  docKey: string,
): { resource: SearchResource; source_id: string } | null {
  if (docKey.startsWith("ent:")) {
    return { resource: "entity", source_id: docKey.slice(4) };
  }
  if (docKey.startsWith("msg:")) {
    return { resource: "message", source_id: docKey.slice(4) };
  }
  return null;
}
