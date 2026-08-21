import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { loadResolvedWorldContext } from "@freeanima/client/portal-sdk/world-context.ts";

import { buildAnimaMentionInsert, type AnimaMentionMenuEntry } from "./anima-mention-menu.ts";

type ListItem = {
  id: number;
  title: string;
  primary_component: string | null;
};

async function listForSubject(subject_id: number, query: string): Promise<ListItem[]> {
  try {
    const data = await getTypedHabitatClient().call("entity.list", {
      subject_id,
      limit: 20,
      offset: 0,
      ...(query.trim() ? { query: query.trim() } : {}),
    });
    return (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? "",
      primary_component: item.primary_component ?? null,
    }));
  } catch {
    return [];
  }
}

/** 扫 user + 默认 chat agent，按 id 去重；不限 primary_component */
export async function searchAnimaMentionEntities(query: string): Promise<AnimaMentionMenuEntry[]> {
  const ctx = await loadResolvedWorldContext();
  const subjectIds = [ctx.user_subject_id];
  if (
    ctx.default_chat_agent_subject_id != null &&
    ctx.default_chat_agent_subject_id > 0 &&
    ctx.default_chat_agent_subject_id !== ctx.user_subject_id
  ) {
    subjectIds.push(ctx.default_chat_agent_subject_id);
  }
  const lists = await Promise.all(subjectIds.map((id) => listForSubject(id, query)));
  const seen = new Set<number>();
  const merged: ListItem[] = [];
  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.map((item) => ({
    id: item.id,
    label: item.title || `anima:${item.id}`,
    insertText: buildAnimaMentionInsert(item.id),
    ...(item.primary_component ? { description: item.primary_component } : {}),
  }));
}
