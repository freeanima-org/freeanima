import { defineConfig } from "wxt";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { resolveBuildChannelFromEnv } from "./packages/habitat/core/config/build-meta.ts";
import {
  FIREFOX_ADDON_ID,
  FIREFOX_ADDON_UPDATE_URL,
  resolveFirefoxAddonVersion,
} from "./packages/habitat/core/config/firefox-addon.ts";
import { resolveBuildVersionFromEnv } from "./packages/habitat/core/config/resolve-build-version.ts";
import { buildViteAliases } from "./packages/frontend/client/app-frame/vite/module-aliases.ts";

const repoRoot = path.resolve(import.meta.dirname);

/**
 * WXT/Vite 依赖扫描会经 `@freeanima/* → src/*` 扫到 Web 的 PwaNotices，
 * 而扩展构建不挂 vite-plugin-pwa。提供空 stub，避免 scan 失败警告。
 */
function stubVirtualPwaRegisterPlugin(): Plugin {
  const id = "virtual:pwa-register";
  return {
    name: "freeanima-stub-virtual-pwa-register",
    resolveId(source) {
      if (source === id) return id;
      return undefined;
    },
    load(source) {
      if (source !== id) return undefined;
      return `export function registerSW() { return async () => {}; }\n`;
    },
  };
}

/**
 * Chrome 扩展 manifest.version 仅允许 1-4 个点分整数（≤65535），不支持 semver 预发/构建后缀。
 * 从完整版本串中剥离 `-local+…` / `-canary+…` 等后缀，保留基版本号。
 */
function resolveChromeManifestVersion(full: string): string {
  return full.replace(/[-+].*$/, "");
}

const buildChannel = resolveBuildChannelFromEnv("local");
const appVersion = resolveBuildVersionFromEnv(repoRoot, process.env, { channel: buildChannel });
const chromeManifestVersion = resolveChromeManifestVersion(appVersion);
const firefoxManifestVersion = resolveFirefoxAddonVersion(appVersion);
const isLocal = buildChannel === "local";
const extensionName = isLocal ? "FreeAnima Local" : "FreeAnima";

/** 浏览器形态入口（MV3；Chrome 默认，Firefox 另轨） */
export default defineConfig({
  srcDir: "packages/frontend/portal/extension",
  outDir: "dist/browser-extension",
  publicDir: "packages/frontend/portal/extension/public",
  modules: [],
  // Firefox 默认 MV2；强制 MV3（与 Chrome 同轨，且支持 update_url / service worker）
  manifestVersion: 3,
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";
    return {
      name: extensionName,
      description: "FreeAnima 浏览器形态入口：连接栖息地；含保险库自动填充与密码生成",
      version: isFirefox ? firefoxManifestVersion : chromeManifestVersion,
      // version_name 为 Chrome 扩展；Firefox / AMO 不使用
      ...(isFirefox ? {} : { version_name: appVersion }),
      icons: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        128: "icon-128.png",
      },
      permissions: [
        "storage",
        "activeTab",
        "tabs",
        "contextMenus",
        "scripting",
        "notifications",
        "bookmarks",
        "alarms",
      ],
      host_permissions: ["http://*/*", "https://*/*"],
      commands: {
        "autofill-login": {
          suggested_key: { default: "Ctrl+Shift+L" },
          description: "自动填充当前页登录凭据",
        },
        "open-popup": {
          suggested_key: { default: "Ctrl+Shift+Y" },
          description: "打开扩展弹窗",
        },
        "generate-password": {
          suggested_key: { default: "Ctrl+Shift+G" },
          description: "生成密码并填入焦点字段",
        },
      },
      action: {
        default_title: extensionName,
        default_icon: {
          16: "icon-16.png",
          32: "icon-32.png",
          48: "icon-48.png",
          128: "icon-128.png",
        },
      },
      options_ui: {
        open_in_tab: true,
      },
      ...(isFirefox
        ? {
            // Firefox MV3 默认 CSP 含 upgrade-insecure-requests，会把局域网 http Habitat 升成 https
            content_security_policy: {
              extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
            },
            browser_specific_settings: {
              gecko: {
                id: FIREFOX_ADDON_ID,
                update_url: FIREFOX_ADDON_UPDATE_URL,
                strict_min_version: "109.0",
                data_collection_permissions: {
                  required: ["none"],
                },
              },
            },
          }
        : {}),
    };
  },
  vite: () => ({
    plugins: [stubVirtualPwaRegisterPlugin(), react(), tailwindcss()],
    resolve: {
      alias: buildViteAliases({ repoRoot }),
    },
  }),
});
