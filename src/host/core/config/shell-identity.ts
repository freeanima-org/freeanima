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

/** 正式 / canary / release：对齐 freeanima.com reverse-DNS，不以 `.app` 结尾 */
const DESKTOP_RELEASE: DesktopShellIdentity = {
  appId: "com.freeanima.portal",
  productName: "FreeAnima",
  executableName: "FreeAnima",
};

const DESKTOP_DEV: DesktopShellIdentity = {
  appId: "com.freeanima.portal.dev",
  productName: "FreeAnima Dev",
  executableName: "FreeAnima-Dev",
};

const MOBILE_RELEASE: MobileShellIdentity = {
  applicationId: "com.freeanima.portal",
  appName: "FreeAnima",
};

const MOBILE_DEV: MobileShellIdentity = {
  applicationId: "com.freeanima.portal.dev",
  appName: "FreeAnima Dev",
};

/** 仅 `dev` 使用独立身份；canary/release 共用正式身份 */
export function resolveDesktopShellIdentity(channel: BuildChannel): DesktopShellIdentity {
  return channel === "dev" ? DESKTOP_DEV : DESKTOP_RELEASE;
}

export function resolveMobileShellIdentity(channel: BuildChannel): MobileShellIdentity {
  return channel === "dev" ? MOBILE_DEV : MOBILE_RELEASE;
}
