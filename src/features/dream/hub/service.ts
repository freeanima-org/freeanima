import {
  countDreamEntries,
  getDreamEntryByDay,
  listDreamEntries,
  resolveDreamWorldId,
} from "@freeanima/capabilities/memory/dream-store";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps) {
  const worldId = await resolveDreamWorldId();
  return { worldId };
}

export async function serviceDreamList(
  deps: RuntimeDeps,
  input: { offset?: number; limit?: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps);
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.max(1, Math.min(100, input.limit ?? 20));
  const [items, total] = await Promise.all([
    listDreamEntries(ctx, { offset, limit }),
    countDreamEntries(ctx),
  ]);
  return { items, total, offset, limit };
}

export async function serviceDreamGet(deps: RuntimeDeps, input: { day: string }) {
  assertPg(deps);
  const ctx = await storeContext(deps);
  const day = input.day.trim();
  if (!day) throw new Error("day is required");
  const item = await getDreamEntryByDay(ctx, day);
  if (!item) throw new Error(`No dream found for ${day}`);
  return { item };
}
