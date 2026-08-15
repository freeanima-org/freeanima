import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import {
  peerRollRedisKey,
  resolveTemporalSummaryConfig,
  runTemporalSummaryTick,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";

/** Cron: half-hour conversation chunks + warm peer roll Redis cache */
export async function runTemporalSummaryTickHandler(): Promise<string> {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  if (!config.enabled) {
    return JSON.stringify({ ok: true, skipped: "disabled" });
  }
  const result = await runTemporalSummaryTick({
    config,
    peerCache: {
      getJson: cacheGetJson,
      setJson: cacheSetJson,
    },
  });
  return JSON.stringify(result);
}

export function buildPeerRollKey(
  prefix: string,
  cst_date: string,
  bucket: string,
  sources_fp: string,
): string {
  return peerRollRedisKey({ prefix, cst_date, bucket, sources_fp });
}
