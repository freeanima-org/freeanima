import type { BuildChannel } from "./build-meta.parse.ts";

export type DesktopShellIdentity = {
  appId: string;
  productName: string;
  executableName: string;
};

export type MobileShellIdentity = {
  applicationId: string;
  appName: string;
};

const DESKTOP_RELEASE: DesktopShellIdentity = {
  appId: "org.freeanima.desktop",
  productName: "FreeAnima Desktop",
  executableName: "FreeAnima-Desktop",
};

const DESKTOP_DEV: DesktopShellIdentity = {
  appId: "org.freeanima.desktop.dev",
  productName: "FreeAnima Desktop Dev",
  executableName: "FreeAnima-Desktop-Dev",
};

const MOBILE_RELEASE: MobileShellIdentity = {
  applicationId: "org.freeanima.app",
  appName: "FreeAnima",
};

const MOBILE_DEV: MobileShellIdentity = {
  applicationId: "org.freeanima.app.dev",
  appName: "FreeAnima Dev",
};

/** 仅 `dev` 使用独立身份；canary/release 共用正式身份 */
export function resolveDesktopShellIdentity(channel: BuildChannel): DesktopShellIdentity {
  return channel === "dev" ? DESKTOP_DEV : DESKTOP_RELEASE;
}

export function resolveMobileShellIdentity(channel: BuildChannel): MobileShellIdentity {
  return channel === "dev" ? MOBILE_DEV : MOBILE_RELEASE;
}
