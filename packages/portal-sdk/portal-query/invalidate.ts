import { getDefaultPortalQueryClient, type InvalidateFilter } from "./client.ts";

/** 写成功后的统一 invalidate 出口（默认 client）。 */
export async function invalidatePortalReads(filter: InvalidateFilter): Promise<void> {
  await getDefaultPortalQueryClient().invalidateQueries(filter);
}
