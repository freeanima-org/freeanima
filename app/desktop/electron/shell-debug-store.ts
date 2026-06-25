import type { ShellDebugConfig } from "@freeanima/satellite-sdk";
import { loadDebugConfigFromStore, saveDebugConfigToStore } from "./shell-scoped-prefs.ts";

export function readShellDebugConfig(): ShellDebugConfig {
  return loadDebugConfigFromStore();
}

export function writeShellDebugConfig(config: ShellDebugConfig): ShellDebugConfig {
  return saveDebugConfigToStore(config);
}
