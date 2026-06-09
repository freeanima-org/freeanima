import { rebuildAllFtsSegments, type FtsRebuildResult } from "@freeanima/connectors-db-pg";
import { getCjkConfigSnapshot, type CjkConfigSnapshot } from "@freeanima/service-config";

export type { FtsRebuildResult, CjkConfigSnapshot };

export function getFtsStatus(): CjkConfigSnapshot {
  return getCjkConfigSnapshot();
}

export async function rebuildFtsIndex(): Promise<FtsRebuildResult> {
  return rebuildAllFtsSegments();
}
