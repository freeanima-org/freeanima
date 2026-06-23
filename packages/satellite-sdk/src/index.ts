export {
  connectionKindSchema,
  frontendManifestSchema,
  parseManifestJson,
  toManifestJson,
} from "./manifest.ts";
export type { ConnectionKind, FrontendManifest } from "./manifest.ts";

export type {
  CompanionShellApi,
  CompanionWindowRole,
  PatrolScreenInfo,
  SatelliteShellApi,
  ScreenPoint,
} from "./shell-api.ts";

export type {
  DesktopProfile,
  DesktopWindowSpec,
  EmbeddedSidecarDesktopProfile,
  FrontendDesktopExport,
  FrontendMobileExport,
  HubRemoteDesktopProfile,
  MobileProfile,
  SapDirectDesktopProfile,
  WindowKind,
} from "./profile.ts";

export { UnsupportedMobileError } from "./mobile-errors.ts";
export { readMonorepoVersion } from "./version.ts";
