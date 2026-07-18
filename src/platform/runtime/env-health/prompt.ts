import { getAppRuntime, getRuntimeDeps } from "../runtime-context.ts";
import { getBaselineStore } from "./baseline.ts";
import { formatEnvHealthPromptSection } from "./format.ts";
import type { EnvHealthMarkers } from "./types.ts";

/**
 * 供 system prompt：读基线；若无则采集一次并落盘（不发通知）。
 */
export async function loadOrCollectBaselineMarkers(): Promise<EnvHealthMarkers> {
  const store = getBaselineStore();
  const existing = await store.load();
  if (existing) return existing;

  const { collectMarkers } = await import("./markers.ts");
  const runtime = getAppRuntime();
  const markers = await collectMarkers({
    startTimeSec: runtime.start_time,
    deps: getRuntimeDeps(),
  });
  await store.save(markers);
  return markers;
}

export async function buildEnvHealthPromptSectionContent(): Promise<string> {
  const markers = await loadOrCollectBaselineMarkers();
  return formatEnvHealthPromptSection(markers);
}
