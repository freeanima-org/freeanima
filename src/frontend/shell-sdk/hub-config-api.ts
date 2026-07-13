import { satelliteHubRpcCall } from "./hub-rpc-call.ts";

export async function fetchHubConfig(): Promise<Record<string, unknown>> {
  return satelliteHubRpcCall<Record<string, unknown>>("config.get", {});
}

export async function fetchHubConfigSection(section: string): Promise<unknown> {
  return satelliteHubRpcCall("config.getSection", { section });
}

export async function patchHubConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return satelliteHubRpcCall<Record<string, unknown>>("config.patchSection", { section, patch });
}

export async function replaceHubConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return satelliteHubRpcCall<Record<string, unknown>>("config.replaceSection", { section, value });
}

export async function restartHubService(): Promise<void> {
  await satelliteHubRpcCall("status.restart", {});
}

export type HubConfigTestService = "firecrawl" | "camofox" | "embedding" | "llm_provider";

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
  return satelliteHubRpcCall<HubConfigTestConnectionResult>("config.testConnection", input);
}
