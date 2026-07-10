import { getEntity } from "@freeanima/core/db/pg/entity";

export async function worldIdForAccount(accountId: number): Promise<number> {
  const row = await getEntity(accountId);
  if (!row) throw new Error(`email account not found: ${accountId}`);
  return row.world_id;
}

export async function worldIdForThread(threadId: number): Promise<number> {
  const row = await getEntity(threadId);
  if (!row) throw new Error(`email thread not found: ${threadId}`);
  return row.world_id;
}
