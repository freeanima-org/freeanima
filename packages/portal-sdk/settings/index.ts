export type { SettingsStorageScope } from "./scopes.ts";
export {
  COMPANION_CONFIG_SCOPE,
  COMPANION_SHELL_SCOPE,
  DEBUG_SETTINGS_SCOPE,
  HABITAT_SETTINGS_SCOPE,
} from "./scopes.ts";
export {
  DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
  HABITAT_URL_KEY,
  readStoredHabitatUrl,
  COMPANION_VISIBLE_KEY,
  LAUNCH_AT_LOGIN_KEY,
  NATIVE_BUILD_META_KEY,
  REMOTE_AUTH_TOKEN_KEY,
  sapInstanceKey,
} from "./prefs-keys.ts";
export type { ScopedSettingsBackend, SettingsStore } from "./settings-store.ts";
export { createScopedSettingsStore } from "./settings-store.ts";
export {
  createDebugSettingsStore,
  createHabitatSettingsStore,
  parseHabitatClientSettings,
} from "./habitat-debug-stores.ts";
export type {
  CompanionSettingsApi,
  FormFieldDescriptor,
  FormFieldType,
  SettingsBinding,
  SettingsComponentEntry,
  SettingsComponentLoader,
  SettingsFormEntry,
  SettingsFormFields,
  SettingsPanelProps,
  SettingsPlatform,
  SettingsCategory,
  SettingsPlatformEntry,
  SettingsSection,
  SettingsSectionDeps,
} from "./types.ts";
export { defineSettingsForm, listSettingsSectionsForPlatform } from "./types.ts";
export {
  desktopGeneralSettingsSection,
  habitatFields,
  habitatSettingsSection,
} from "./sections/habitat-section.ts";
export { debugSettingsSection } from "./sections/debug-section.ts";
