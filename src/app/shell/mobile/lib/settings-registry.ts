import { createBrowserLikeSettingsBindings } from "../../shared/browser-like-settings-bindings.ts";
import type { MobileSettingsStores } from "./settings-stores.ts";

export function createMobileSettingsBindings(stores: MobileSettingsStores) {
  return createBrowserLikeSettingsBindings(stores);
}
