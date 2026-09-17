import type { ShellApi } from "@freeanima/portal-sdk/shell-api";

declare global {
  interface Window {
    portalShell?: ShellApi;
  }
}

declare module "*.css" {}
