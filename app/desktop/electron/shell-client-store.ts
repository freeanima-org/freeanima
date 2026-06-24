import {
  loadShellClientConfig,
  normalizeShellClientConfig,
  saveShellClientConfig,
  type ShellClientConfig,
} from "@freeanima/satellite-sdk/shell-client-config-node";

export function readShellClientConfig(): ShellClientConfig | null {
  return loadShellClientConfig();
}

export function writeShellClientConfig(config: ShellClientConfig): void {
  saveShellClientConfig(normalizeShellClientConfig(config));
}
