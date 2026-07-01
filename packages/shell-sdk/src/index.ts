export { frontendManifestSchema, parseManifestJson, toManifestJson } from "./manifest.ts";
export type { FrontendManifest } from "./manifest.ts";

import * as shellApi from "./shell-api.ts";

void shellApi;

export type {
  CompanionWindowRole,
  PatrolScreenInfo,
  SapInstanceStore,
  SatelliteShellApi,
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
export { normalizeShellClientConfig, parseShellClientConfig } from "./shell-client-config.ts";
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
  isLoopbackHubUrl,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
  shellConfigToRemoteAuth,
} from "./remote-auth.ts";
export {
  buildShellApiFields,
  connectAuthTokenForHub,
  hubRequiresRemoteAuth,
} from "./shell-api-fields.ts";
export type { HubHealthBody } from "./hub-health-probe.ts";
export {
  HUB_HEALTH_PROBE_TIMEOUT_MS,
  hubHealthFailureReason,
  isHubHealthConnected,
  probeHubHealthUrl,
  testHubHealthConnection,
} from "./hub-health-probe.ts";
export type { ResolvedWorldContext } from "./world-context.ts";
export { fetchWorldContext, resetWorldContextCacheForTest } from "./world-context.ts";
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
