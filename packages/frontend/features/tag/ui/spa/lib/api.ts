import { getSubjectKind } from "@freeanima/client/portal-sdk";
import type { TagRowPayload } from "@freeanima/shared/rpc-contract/frames/tag.ts";

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type TagRow = TagRowPayload;

export type TagSuggestion = {
  id: number;
  title: string;
  count: number;
};

export type TagKnown = { id: number; title: string };

function habitat() {
  return getTypedHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

/** 写入 method 默认 WS；显式 http 以便浏览器扩展（不连 Habitat WS）也能建签/改签 */
const httpOnly = { transport: "http" as const };

export async function fetchTags(): Promise<TagRow[]> {
  const data = await habitat().call("tag.list", withSubjectKind({}), httpOnly);
  return data.tags;
}

export async function searchTags(query: string, opts?: { limit?: number }): Promise<TagRow[]> {
  const data = await habitat().call(
    "tag.search",
    withSubjectKind({
      query,
      ...(opts?.limit != null ? { limit: opts.limit } : {}),
    }),
    httpOnly,
  );
  return data.tags;
}

export async function suggestTags(
  primaryComponent: string,
  opts?: { query?: string; limit?: number },
): Promise<TagSuggestion[]> {
  const data = await habitat().call(
    "tag.suggest",
    withSubjectKind({
      primary_component: primaryComponent,
      ...(opts?.query != null ? { query: opts.query } : {}),
      ...(opts?.limit != null ? { limit: opts.limit } : {}),
    }),
    httpOnly,
  );
  return data.items;
}

export async function createTag(title: string): Promise<TagRow> {
  const data = await habitat().call("tag.create", withSubjectKind({ title }), httpOnly);
  return data.item;
}

export async function setEntityTagIds(entityId: number, tagIds: number[]): Promise<number[]> {
  const data = await habitat().call(
    "tag.setOnEntity",
    withSubjectKind({ entity_id: entityId, tag_ids: tagIds }),
    httpOnly,
  );
  return data.tag_ids;
}
