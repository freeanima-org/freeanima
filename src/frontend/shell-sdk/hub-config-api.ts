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

export async function restartHubService(): Promise<void> {
  await satelliteHubRpcCall("status.restart", {});
}
