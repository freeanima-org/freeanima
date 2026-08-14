import { resolveBuildChannelFromEnv } from "./build-meta.ts";
import type { BuildChannel } from "./build-meta.parse.ts";
import { resolveBuildVersionFromEnv } from "./resolve-build-version.ts";

/** GitHub Release / updater 固定资产名（勿改，除非同步 matchReleaseAsset） */
export const PACK_ARTIFACT_STABLE_NAMES = {
  "standalone-linux-tarball": "anima-linux-x64.tar.gz",
  "desktop-windows-nsis": "freeanima-desktop-windows-x64-setup.exe",
  "desktop-linux-appimage": "freeanima-desktop-tauri-linux.AppImage",
  "mobile-android-apk": "freeanima-mobile-android.apk",
  "browser-extension-zip": "freeanima-browser-extension.zip",
  "browser-extension-firefox-xpi": "freeanima-browser-extension-firefox.xpi",
  "browser-extension-firefox-updates": "freeanima-browser-extension-firefox-updates.json",
} as const;

export type PackArtifactKind = keyof typeof PACK_ARTIFACT_STABLE_NAMES;

export type PackArtifactMeta = {
  channel: BuildChannel;
  version: string;
  /** 文件名安全版本串（`+` → `.`） */
  versionToken: string;
};

/** 将版本串收成文件名安全 token（保留 `-` `.` `_`） */
export function sanitizePackVersionToken(version: string): string {
  return version
    .trim()
    .replace(/^v/i, "")
    .replace(/\+/g, ".")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolvePackArtifactMeta(
  repoRoot?: string,
  env: NodeJS.ProcessEnv = process.env,
): PackArtifactMeta {
  const channel = resolveBuildChannelFromEnv("local", env);
  const version = resolveBuildVersionFromEnv(repoRoot, env, { channel });
  return { channel, version, versionToken: sanitizePackVersionToken(version) };
}

/**
 * 版本化文件名：`…-{versionToken}-{channel}…`
 * 例：`freeanima-desktop-windows-x64-0.9.2-local.202608070617-local-setup.exe`
 */
export function packArtifactVersionedName(kind: PackArtifactKind, meta: PackArtifactMeta): string {
  const { versionToken, channel } = meta;
  switch (kind) {
    case "standalone-linux-tarball":
      return `anima-linux-x64-${versionToken}-${channel}.tar.gz`;
    case "desktop-windows-nsis":
      return `freeanima-desktop-windows-x64-${versionToken}-${channel}-setup.exe`;
    case "desktop-linux-appimage":
      return `freeanima-desktop-tauri-linux-${versionToken}-${channel}.AppImage`;
    case "mobile-android-apk":
      return `freeanima-mobile-android-${versionToken}-${channel}.apk`;
    case "browser-extension-zip":
      return `freeanima-browser-extension-${versionToken}-${channel}.zip`;
    case "browser-extension-firefox-xpi":
      return `freeanima-browser-extension-firefox-${versionToken}-${channel}.xpi`;
    case "browser-extension-firefox-updates":
      return `freeanima-browser-extension-firefox-updates-${versionToken}-${channel}.json`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function packArtifactStableName(kind: PackArtifactKind): string {
  return PACK_ARTIFACT_STABLE_NAMES[kind];
}

/** 本地脚本仍可能引用的历史别名（与 stable 同内容） */
export function packArtifactLegacyAliases(kind: PackArtifactKind): string[] {
  switch (kind) {
    case "desktop-windows-nsis":
      return ["freeanima-desktop-tauri-windows-x64-setup.exe"];
    case "mobile-android-apk":
      return ["freeanima-mobile-tauri-android.apk"];
    default:
      return [];
  }
}
