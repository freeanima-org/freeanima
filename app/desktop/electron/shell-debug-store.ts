import type { ShellDebugConfig } from "@freeanima/satellite-sdk";
import {
  loadShellDebugConfig,
  saveShellDebugConfig,
} from "@freeanima/satellite-sdk/shell-settings-node";

export function readShellDebugConfig(): ShellDebugConfig {
  return loadShellDebugConfig();
}

export function writeShellDebugConfig(config: ShellDebugConfig): ShellDebugConfig {
  return saveShellDebugConfig(config);
}
