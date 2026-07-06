export type { SettingsStorageScope } from "./scopes.ts";
export { COMPANION_CONFIG_SCOPE, DEBUG_SETTINGS_SCOPE, HUB_SETTINGS_SCOPE } from "./scopes.ts";
export {
  DEBUG_SENTRY_DSN_KEY,
  DEBUG_SENTRY_ENABLED_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
  HUB_URL_KEY,
  COMPANION_VISIBLE_KEY,
  LAUNCH_AT_LOGIN_KEY,
  REMOTE_AUTH_TOKEN_KEY,
  sapInstanceKey,
} from "./prefs-keys.ts";
export type { ScopedSettingsBackend, SettingsStore } from "./settings-store.ts";
export { createScopedSettingsStore } from "./settings-store.ts";
export {
  createDebugSettingsStore,
  createHubSettingsStore,
  parseHubClientSettings,
} from "./hub-debug-stores.ts";
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
export { desktopGeneralSettingsSection, hubSettingsSection } from "./sections/hub-section.ts";
export { debugSettingsSection } from "./sections/debug-section.ts";
