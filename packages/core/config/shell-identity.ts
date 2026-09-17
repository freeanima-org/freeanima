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

/** 本机 local 轨：appId/可执行名后缀仍用 `.dev`，避免已装本机包与 `~/.anima-dev` 断裂 */
const DESKTOP_LOCAL: DesktopShellIdentity = {
  appId: "com.freeanima.portal.dev",
  productName: "FreeAnima Local",
  executableName: "FreeAnima-Dev",
};

const MOBILE_RELEASE: MobileShellIdentity = {
  applicationId: "com.freeanima.portal",
  appName: "FreeAnima",
};

const MOBILE_LOCAL: MobileShellIdentity = {
  applicationId: "com.freeanima.portal.dev",
  appName: "FreeAnima Local",
};

/** 仅 `local` 使用独立身份；canary/release 共用正式身份 */
export function resolveDesktopShellIdentity(channel: BuildChannel): DesktopShellIdentity {
  return channel === "local" ? DESKTOP_LOCAL : DESKTOP_RELEASE;
}

export function resolveMobileShellIdentity(channel: BuildChannel): MobileShellIdentity {
  return channel === "local" ? MOBILE_LOCAL : MOBILE_RELEASE;
}
