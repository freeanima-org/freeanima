import type { DreamEntryRowPayload, DreamListOutput } from "@freeanima/shared/sap-contract";

import { getSatelliteHubClient } from "@freeanima/shared/hub-client";

export type DreamEntryRow = DreamEntryRowPayload;

function hub() {
  return getSatelliteHubClient();
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
