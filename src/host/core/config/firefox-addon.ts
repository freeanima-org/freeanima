/**
 * Firefox Vault 扩展（维护者自托管 canary）身份与版本约定。
 * Chrome 构建不读取本模块的 gecko 字段。
 */

/** 固定 gecko id；变更即视为新扩展，已装用户须重装 */
export const FIREFOX_ADDON_ID = "vault@freeanima.com";

/** site Pages 稳定 URL（与 install.sh → freeanima.com/install 同模式） */
export const FIREFOX_ADDON_UPDATE_URL = "https://freeanima.com/extension/firefox/updates.json";

/** canary Release 固定资产名（签名 xpi） */
export const FIREFOX_ADDON_XPI_STABLE_NAME = "freeanima-browser-extension-firefox.xpi";

/** canary Release 上供 site sync 拉取的 updates.json 副本 */
export const FIREFOX_ADDON_UPDATES_ASSET_NAME = "freeanima-browser-extension-firefox-updates.json";

export const FIREFOX_ADDON_CANARY_XPI_URL = `https://github.com/freeanima-org/freeanima/releases/download/canary/${FIREFOX_ADDON_XPI_STABLE_NAME}`;

export const FIREFOX_ADDON_CANARY_UPDATES_ASSET_URL = `https://github.com/freeanima-org/freeanima/releases/download/canary/${FIREFOX_ADDON_UPDATES_ASSET_NAME}`;

/**
 * 将完整构建版本串收成 Firefox/AMO 可用的点分整数版本。
 * canary/local 带 `+YYYYMMDDHHmm` 时写入第 4 段，保证每轮可升、可签。
 *
 * 例：`0.9.2-canary+202608121035` → `0.9.2.202608121035`
 * 例：`0.9.2` → `0.9.2`
 */
export function resolveFirefoxAddonVersion(fullBuildVersion: string): string {
  const trimmed = fullBuildVersion.trim().replace(/^v/i, "");
  const base = trimmed.replace(/[-+].*$/, "");
  if (!/^\d+(\.\d+){0,3}$/.test(base)) {
    throw new Error(`invalid firefox addon base version from: ${fullBuildVersion}`);
  }
  const stamp = trimmed.match(/\+(\d{12})\b/)?.[1];
  if (!stamp) return base;
  const parts = base.split(".");
  if (parts.length >= 4) {
    return `${parts.slice(0, 3).join(".")}.${stamp}`;
  }
  return `${base}.${stamp}`;
}

/** 写出 AMO / Firefox 自托管 updates.json 正文 */
export function buildFirefoxAddonUpdatesJson(addonVersion: string): string {
  const body = {
    addons: {
      [FIREFOX_ADDON_ID]: {
        updates: [
          {
            version: addonVersion,
            update_link: FIREFOX_ADDON_CANARY_XPI_URL,
          },
        ],
      },
    },
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}
