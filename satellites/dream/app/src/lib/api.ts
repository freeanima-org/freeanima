import type { DreamEntryRowPayload, DreamListOutput } from "@freeanima/sap-contract";

import { whenSapClientReady } from "./hub-rpc.ts";

export type DreamEntryRow = DreamEntryRowPayload;

export async function fetchDreamList(opts?: {
  offset?: number;
  limit?: number;
}): Promise<DreamListOutput> {
  const client = await whenSapClientReady();
  return client.request("dream.list", {
    offset: opts?.offset,
    limit: opts?.limit,
  });
}

export async function fetchDreamByDay(day: string): Promise<DreamEntryRow> {
  const client = await whenSapClientReady();
  const data = await client.request("dream.get", { day });
  return data.item;
}
