/** 与 CI Release 产物名对齐 */
export type PackagedReleaseKind = "standalone-linux-x64" | "desktop-windows" | "mobile-android";

export const RELEASE_ASSET_NAMES: Record<PackagedReleaseKind, string> = {
  "standalone-linux-x64": "anima-linux-x64.tar.gz",
  "desktop-windows": "freeanima-desktop-windows-x64-setup.exe",
  /** 若 Release 尚未挂 APK，匹配失败 → 不提示升级 */
  "mobile-android": "freeanima-mobile-android.apk",
};

export type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

export function matchReleaseAsset(
  kind: PackagedReleaseKind,
  assets: readonly GithubReleaseAsset[],
): GithubReleaseAsset | null {
  const want = RELEASE_ASSET_NAMES[kind];
  return assets.find((a) => a.name === want) ?? null;
}
