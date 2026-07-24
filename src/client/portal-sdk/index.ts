export { frontendManifestSchema, parseManifestJson, toManifestJson } from "./manifest.ts";
export type { FrontendManifest } from "./manifest.ts";

import * as shellApi from "./shell-api.ts";

void shellApi;

export type {
  CompanionRuntimeMessage,
  CompanionWindowRole,
  PatrolScreenInfo,
  RemoteInstanceStore,
  ShellApi,
  ScreenPoint,
} from "./shell-api.ts";

export type {
  BundledSpaDesktopProfile,
  DesktopProfile,
  DesktopWindowSpec,
  EmbeddedSidecarDesktopProfile,
  FrontendDesktopExport,
  FrontendMobileExport,
  MobileProfile,
  WindowKind,
} from "./profile.ts";

export { UnsupportedMobileError } from "./mobile-errors.ts";
export type { ShellClientConfig } from "./shell-client-config.ts";
export {
  normalizeShellClientConfig,
  parseShellClientConfig,
  shellClientNeedsHabitatSetup,
} from "./shell-client-config.ts";
export type { ShellDebugConfig } from "./shell-debug-config.ts";
export {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
} from "./shell-debug-config.ts";
export type { ShellSettings } from "./shell-settings.ts";
export {
  DEFAULT_SHELL_SETTINGS,
  mergeShellSettings,
  parseShellSettings,
} from "./shell-settings.ts";
export type { RemoteAuthCredentials } from "./remote-auth.ts";
export {
  buildBearerHeaders,
  createBearerFetch,
  isLoopbackHabitatUrl,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
  shellConfigToRemoteAuth,
} from "./remote-auth.ts";
export {
  buildShellApiFields,
  connectAuthTokenForHabitat,
  habitatRequiresRemoteAuth,
} from "./shell-api-fields.ts";
export type {
  BuildChannel,
  BuildComponent,
  ComponentBuildMeta,
  GitBuildInfo,
  NativeShellKind,
} from "./build-meta.ts";
export {
  formatBuildChannelLabel,
  formatBuildMetaLines,
  parseComponentBuildMeta,
} from "./build-meta.ts";
export type { HabitatHealthBody } from "./habitat-health-probe.ts";
export {
  HABITAT_HEALTH_PROBE_TIMEOUT_MS,
  habitatHealthFailureReason,
  isHabitatHealthConnected,
  probeHabitatHealthUrl,
  testHabitatHealthConnection,
} from "./habitat-health-probe.ts";
export type { ResolvedWorldContext } from "./world-context.ts";
export type { SubjectKind } from "./subject-scope.ts";
export {
  SUBJECT_SCOPE_STORAGE_KEY,
  resolveSubjectId,
  resolveWorldIdForSubject,
} from "./subject-scope.ts";
export {
  getSubjectKind,
  resetSubjectScopeForTest,
  setSubjectKind,
  subscribeSubjectKind,
} from "./subject-scope-store.ts";
export type {
  EmailModuleSelection,
  ModuleSelectionContext,
  ModuleSelectionModule,
  TaskModuleSelection,
} from "./module-selection.ts";
export {
  clearModuleSelection,
  readModuleSelection,
  resetModuleSelectionForTest,
  writeModuleSelection,
} from "./module-selection.ts";
export type { ShellModuleId } from "./shell-module-visibility.ts";
export {
  SHELL_MODULE_IDS,
  SHELL_MODULE_LOCKED,
  isShellModuleVisible,
  readShellModuleVisibility,
  resetShellModuleVisibilityForTest,
  resolveDefaultVisibleModulePath,
  resolveShellModuleIdFromPath,
  subscribeShellModuleVisibility,
  writeShellModuleVisibility,
} from "./shell-module-visibility.ts";
export type { ColorThemeId } from "./color-theme.ts";
export {
  COLOR_THEME_IDS,
  COLOR_THEME_SWATCH,
  DEFAULT_COLOR_THEME,
  applyColorTheme,
  parseColorTheme,
  readColorTheme,
  resetColorThemeForTest,
  subscribeColorTheme,
  writeColorTheme,
} from "./color-theme.ts";
export {
  normalizeShellModuleOrder,
  readShellModuleOrder,
  resetShellModuleOrderForTest,
  subscribeShellModuleOrder,
  writeShellModuleOrder,
} from "./shell-module-order.ts";
export {
  UserVaultSession,
  VAULT_UI_SCOPE,
  getUserVaultSession,
  resetUserVaultSessionForTest,
} from "./vault/user-vault-session.ts";
export type { UserVaultSessionState, UserVaultUnlockInput } from "./vault/user-vault-session.ts";
export {
  registerVaultRpcHandlers,
  resetVaultRpcHandlersForTest,
} from "./vault/vault-rpc-handlers.ts";
export type {
  PomodoroActiveState,
  PomodoroFocusSegmentDraft,
  PomodoroPhase,
  TimerRunState,
} from "./pomodoro-active-types.ts";
export {
  buildTaskFocusSegmentPayloads,
  normalizeRestoredActiveState,
  openWorkFocusSegment,
  primaryTaskItemIdFromSegments,
  switchWorkFocusTask,
} from "./pomodoro-focus-segments.ts";
export type { PomodoroTaskFocusSegmentPayload } from "./pomodoro-focus-segments.ts";
export {
  clearPomodoroActiveStateForTest,
  readPomodoroActiveState,
  switchPomodoroActiveTask,
  writePomodoroActiveState,
} from "./pomodoro-active.ts";
export type { PomodoroLaunchParams } from "./pomodoro-launch.ts";
export {
  clearPomodoroLaunchParamsFromUrl,
  navigateAppModulePath,
  readPomodoroLaunchParamsFromLocation,
} from "./pomodoro-launch.ts";
export { launchPomodoroForTask } from "./pomodoro-task-launch.ts";
export type { PomodoroTaskLaunchInput } from "./pomodoro-task-launch.ts";
export {
  actualDurationMs,
  effectiveFinishedAtIso,
  effectivePhaseFinishedAtMs,
} from "./pomodoro-phase-timing.ts";
export { getPomodoroDeviceId, clearPomodoroDeviceIdForTest } from "./pomodoro-device-id.ts";
export {
  activeStateToHabitatBody,
  habitatBodyToActiveState,
  habitatRowMeta,
} from "./pomodoro-active-store.ts";
export type { PomodoroActiveHabitatRow } from "./pomodoro-active-store.ts";
export {
  applyLocalPomodoroActive,
  buildHubActivePayload,
  dispatchPomodoroActiveChanged,
  getPomodoroSyncMeta,
  getPomodoroSyncSnapshot,
  mergeRemoteActive,
  setPomodoroSyncMeta,
  subscribePomodoroSync,
} from "./pomodoro-sync-local.ts";
export type { PomodoroSyncMeta, PomodoroSyncSnapshot } from "./pomodoro-sync-local.ts";

export type { AnimaPresent, AnimaUriRef, ParseAnimaUriResult } from "./anima-uri.ts";
export {
  animaUriToShellPath,
  defaultPresentForComponent,
  formatAnimaUri,
  navigateAnimaUri,
  parseAnimaUri,
} from "./anima-uri.ts";

export {
  createTypedHabitatClient,
  getTypedHabitatClient,
  getTypedHabitatUiClient,
  resetTypedHabitatClientForTests,
  ensureClientHabitatMethodRegistry,
  type TypedHabitatClient,
  type HabitatMethod,
  type HabitatMethodInputs,
  type HabitatMethodOutputs,
} from "./habitat-typed-client.ts";
