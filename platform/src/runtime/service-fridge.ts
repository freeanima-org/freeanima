import {
  formatFridgeMagnetManifestPreview,
  FRIDGE_MAGNET_SCAN_PATTERN,
  isExcludedFridgeMagnetDisplayKey,
  scanMagnets,
  stripMagnetRedisKeyPrefix,
} from "@freeanima/capabilities-tasks/fridge-magnet";
import { isRedisConfigured, redisTtl } from "@freeanima/platform/connectors/redis";
import type { FridgeMagnet } from "@freeanima/capabilities-tasks/fridge-magnet";

export type FridgeMagnetDisplay = {
  key: string;
  value: string;
  module: "conversation" | "other";
  conversation_id?: string;
  label?: string;
  ttl_seconds: number | null;
};

export type ListFridgeMagnetsResult = {
  redis_configured: boolean;
  magnets: FridgeMagnetDisplay[];
  inject_text: string;
};

function parseDisplayKey(
  displayKey: string,
): Pick<FridgeMagnetDisplay, "module" | "conversation_id" | "label"> {
  const parts = displayKey.split(":");
  const module = parts[0];
  if (module === "conversation" && parts.length >= 3) {
    return {
      module: "conversation",
      conversation_id: parts[1],
      label: parts.slice(2).join(":"),
    };
  }
  return { module: "other" };
}

function toDisplayMagnet(
  hit: { key: string; value: string },
  ttlSeconds: number | null,
): FridgeMagnetDisplay {
  const displayKey = stripMagnetRedisKeyPrefix(hit.key);
  return {
    key: displayKey,
    value: hit.value,
    ttl_seconds: ttlSeconds,
    ...parseDisplayKey(displayKey),
  };
}

/** Admin fridge magnet global read-only list */
export async function listFridgeMagnets(): Promise<ListFridgeMagnetsResult> {
  const redisConfigured = isRedisConfigured();
  const hits = (await scanMagnets(FRIDGE_MAGNET_SCAN_PATTERN)).filter(
    (hit) => !isExcludedFridgeMagnetDisplayKey(stripMagnetRedisKeyPrefix(hit.key)),
  );

  const magnets = await Promise.all(
    hits.map(async (hit) => {
      const ttlSeconds = redisConfigured ? await redisTtl(hit.key) : null;
      return toDisplayMagnet(hit, ttlSeconds);
    }),
  );

  const injectMagnets: FridgeMagnet[] = magnets
    .filter((m) => m.value.trim().length > 0)
    .map(({ key, value }) => ({ key, value }));

  return {
    redis_configured: redisConfigured,
    magnets,
    inject_text: formatFridgeMagnetManifestPreview(injectMagnets),
  };
}
