import type { SatelliteShellApi } from "@freeanima/satellite-sdk/shell-api.ts";

declare global {
  interface Window {
    satelliteShell?: SatelliteShellApi;
  }
}

declare module "*.css" {}

declare module "highlight.js/styles/*.css" {}

declare module "xterm/css/xterm.css" {}
