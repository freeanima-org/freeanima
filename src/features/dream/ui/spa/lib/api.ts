import type { DreamEntryRowPayload, DreamListOutput } from "@freeanima/shared/sap-contract";

import { getDreamHubClient } from "./hub-client.ts";

export type DreamEntryRow = DreamEntryRowPayload;

function hub() {
  return getDreamHubClient();
}

export async function fetchDreamList(opts?: {
  offset?: number;
  limit?: number;
}): Promise<DreamListOutput> {
  return hub().call("dream.list", {
    offset: opts?.offset,
    limit: opts?.limit,
  });
}

export async function fetchDreamByDay(day: string): Promise<DreamEntryRow> {
  const data = await hub().call("dream.get", { day });
  return data.item;
}
