import type { FrontendManifest } from "@freeanima/satellite-sdk";
import { readMonorepoVersion } from "@freeanima/satellite-sdk/version";

const APP_ID = "chamber";

export const CHAMBER_DEFAULT_PATH = "/webui/chamber/dashboard";

export const chamberManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "卧室",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
  connectionKind: "hub-rest",
};

export function getChamberManifest(): FrontendManifest {
  return { ...chamberManifest, version: readMonorepoVersion() };
}

export function resolveChamberUrl(
  hubUrl: string,
  path = CHAMBER_DEFAULT_PATH,
  opts?: { embed?: boolean },
): string {
  const base = hubUrl.replace(/\/$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${rel}`;
  if (!opts?.embed) return url;
  return `${url}${url.includes("?") ? "&" : "?"}embed=1`;
}
