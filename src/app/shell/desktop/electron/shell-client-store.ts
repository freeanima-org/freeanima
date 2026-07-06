import { loadHubConfigFromStore, saveHubConfigToStore } from "./shell-scoped-prefs.ts";
import { normalizeShellClientConfig, type ShellClientConfig } from "@freeanima/shell-sdk";

export function readShellClientConfig(): ShellClientConfig | null {
  return loadHubConfigFromStore();
}

export function writeShellClientConfig(config: ShellClientConfig): void {
  saveHubConfigToStore(normalizeShellClientConfig(config));
}
