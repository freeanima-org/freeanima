import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { buildAnimaMentionInsert, type AnimaMentionMenuEntry } from "./anima-mention-menu.ts";

type ListItem = {
  id: number;
  title: string;
  primary_component: string | null;
};

async function listForKind(subject_kind: "user" | "agent", query: string): Promise<ListItem[]> {
  try {
    const data = await getTypedHabitatClient().call("entity.list", {
      subject_kind,
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

/** 并行扫 user + agent，按 id 去重；不限 primary_component */
export async function searchAnimaMentionEntities(query: string): Promise<AnimaMentionMenuEntry[]> {
  const [userItems, agentItems] = await Promise.all([
    listForKind("user", query),
    listForKind("agent", query),
  ]);
  const seen = new Set<number>();
  const merged: ListItem[] = [];
  for (const item of [...userItems, ...agentItems]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.slice(0, 20).map((item) => {
    const rawTitle = item.title.trim();
    const snippet = rawTitle ? [...rawTitle].slice(0, 24).join("") : `#${item.id}`;
    const component = item.primary_component?.trim() || "entity";
    return {
      id: item.id,
      insertText: buildAnimaMentionInsert(item.id),
      label: `#${item.id}${rawTitle ? ` ${snippet}` : ""}`,
      description: component,
    };
  });
}
