import { createBrowserLikeSettingsBindings } from "../../shared/browser-like-settings-bindings.ts";
import type { WebSettingsStores } from "./settings-stores.ts";

export function createWebSettingsBindings(stores: WebSettingsStores) {
  return createBrowserLikeSettingsBindings(stores);
}
