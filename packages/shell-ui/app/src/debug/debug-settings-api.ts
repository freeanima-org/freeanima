export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

export function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}

declare global {
  interface Window {
    debugSettingsApi?: {
      load(): Promise<import("@freeanima/satellite-sdk").ShellDebugConfig>;
      save(cfg: import("@freeanima/satellite-sdk").ShellDebugConfig): Promise<void>;
    };
  }
}

export async function loadDebugSettingsFromApi(): Promise<
  import("@freeanima/satellite-sdk").ShellDebugConfig | null
> {
  const api = window.debugSettingsApi;
  if (!api) return null;
  return api.load();
}

export async function saveDebugSettingsToApi(
  cfg: import("@freeanima/satellite-sdk").ShellDebugConfig,
): Promise<void> {
  const api = window.debugSettingsApi;
  if (!api) throw new Error("debugSettingsApi 不可用");
  await api.save(cfg);
  notifyDebugConfigChanged();
}
