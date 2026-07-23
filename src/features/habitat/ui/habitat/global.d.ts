import type { ShellApi } from "@freeanima/frontend/shell-sdk/shell-api";

declare global {
  interface Window {
    portalShell?: ShellApi;
  }
}

declare module "*.css" {}

declare module "highlight.js/styles/*.css" {}

declare module "xterm/css/xterm.css" {}
