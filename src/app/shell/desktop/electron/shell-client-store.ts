import { loadHabitatConfigFromStore, saveHabitatConfigToStore } from "./shell-scoped-prefs.ts";
import {
  normalizeShellClientConfig,
  type ShellClientConfig,
} from "@freeanima/frontend/shell-sdk/shell-client-config.ts";

export function readShellClientConfig(): ShellClientConfig | null {
  return loadHabitatConfigFromStore();
}

export function writeShellClientConfig(config: ShellClientConfig): void {
  saveHabitatConfigToStore(normalizeShellClientConfig(config));
}
