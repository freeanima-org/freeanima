import type { ShellDebugConfig } from "@freeanima/frontend/shell-sdk/shell-debug-config.ts";
import { loadDebugConfigFromStore, saveDebugConfigToStore } from "./shell-scoped-prefs.ts";

export function readShellDebugConfig(): ShellDebugConfig {
  return loadDebugConfigFromStore();
}

export function writeShellDebugConfig(config: ShellDebugConfig): ShellDebugConfig {
  return saveDebugConfigToStore(config);
}
