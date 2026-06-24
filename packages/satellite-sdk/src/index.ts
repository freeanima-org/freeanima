export {
  connectionKindSchema,
  frontendManifestSchema,
  parseManifestJson,
  toManifestJson,
} from "./manifest.ts";
export type { ConnectionKind, FrontendManifest } from "./manifest.ts";

import "./shell-api.ts";

export type {
  CompanionShellApi,
  CompanionWindowRole,
  PatrolScreenInfo,
  SapInstanceStore,
  SatelliteShellApi,
  ScreenPoint,
} from "./shell-api.ts";

export type {
  DesktopProfile,
  DesktopWindowSpec,
  EmbeddedSidecarDesktopProfile,
  FrontendDesktopExport,
  FrontendMobileExport,
  HubRestBundledDesktopProfile,
  MobileProfile,
  SapDirectDesktopProfile,
  WindowKind,
} from "./profile.ts";

export { UnsupportedMobileError } from "./mobile-errors.ts";
export type { ShellClientConfig } from "./shell-client-config.ts";
export { normalizeShellClientConfig, parseShellClientConfig } from "./shell-client-config.ts";
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
