export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

export function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}
