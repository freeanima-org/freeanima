import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import type { TagRowPayload } from "@freeanima/shared/sap-contract/frames/tag.ts";

import { getTypedSatelliteHabitatClient } from "@freeanima/platform/habitat/client.ts";

export type TagRow = TagRowPayload;

function hub() {
  return getTypedSatelliteHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchTags(): Promise<TagRow[]> {
  const data = await hub().call("tag.list", withSubjectKind({}));
  return data.tags;
}

export async function createTag(title: string): Promise<TagRow> {
  const data = await hub().call("tag.create", withSubjectKind({ title }));
  return data.item;
}

export async function setEntityTagIds(entityId: number, tagIds: number[]): Promise<number[]> {
  const data = await hub().call(
    "tag.setOnEntity",
    withSubjectKind({ entity_id: entityId, tag_ids: tagIds }),
  );
  return data.tag_ids;
}
