export {
  desktopSettingsPath,
  getDesktopHomeDir,
  legacyShellClientConfigPath,
} from "./desktop-settings-paths.ts";
export {
  loadShellClientConfig,
  loadShellDebugConfig,
  loadShellSettings,
  saveShellClientConfig,
  saveShellDebugConfig,
  saveShellSettings,
} from "./shell-settings-node.ts";
export { normalizeShellClientConfig, parseShellClientConfig } from "./shell-client-config.ts";
export type { ShellClientConfig } from "./shell-client-config.ts";
