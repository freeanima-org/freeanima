import { getBundledHubClient } from "@freeanima/hub-client";

function hub() {
  return getBundledHubClient({ profile: "satellite" });
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

export async function restartHubService(): Promise<void> {
  await hub().call("status.restart", {});
}
