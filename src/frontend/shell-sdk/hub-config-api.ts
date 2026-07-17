import { getBundledHubClient } from "@freeanima/shared/hub-client";

import { resolveHubApiFetch } from "./hub-api-fetch.ts";

function hub() {
  return getBundledHubClient({
    profile: "satellite",
    fetch: resolveHubApiFetch() as typeof fetch,
  });
}

export async function fetchHubConfig(): Promise<Record<string, unknown>> {
  return (await hub().call("config.get", {})) as Record<string, unknown>;
}

export async function fetchHubConfigSection(section: string): Promise<unknown> {
  return hub().call("config.getSection", { section });
}

export async function patchHubConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await hub().call("config.patchSection", { section, patch })) as Record<string, unknown>;
}

export async function replaceHubConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await hub().call("config.replaceSection", { section, value })) as Record<string, unknown>;
}

export async function restartHubService(): Promise<void> {
  await hub().call("status.restart", {});
}

export type HubConfigTestService =
  | "firecrawl"
  | "camofox"
  | "embedding"
  | "llm_provider"
  | "discord"
  | "weixin";

export type HubConfigTestConnectionResult = {
  ok: boolean;
  message: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
};

export async function testHubConfigConnection(input: {
  service: HubConfigTestService;
  config?: Record<string, unknown>;
  provider_id?: string;
}): Promise<HubConfigTestConnectionResult> {
  return (await hub().call("config.testConnection", input)) as HubConfigTestConnectionResult;
}
