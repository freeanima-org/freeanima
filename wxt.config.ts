import { defineConfig } from "wxt";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolveBuildChannelFromEnv } from "./src/host/core/config/build-meta.ts";
import { resolveBuildVersionFromEnv } from "./src/host/core/config/resolve-build-version.ts";
import { buildViteAliases } from "./src/client/app-frame/vite/module-aliases.ts";

const repoRoot = path.resolve(import.meta.dirname);

/**
 * Chrome 扩展 manifest.version 仅允许 1-4 个点分整数（≤65535），不支持 semver 预发/构建后缀。
 * 从完整版本串中剥离 `-local+…` / `-canary+…` 等后缀，保留基版本号。
 */
function resolveManifestVersion(full: string): string {
  return full.replace(/[-+].*$/, "");
}

const buildChannel = resolveBuildChannelFromEnv("local");
const appVersion = resolveBuildVersionFromEnv(repoRoot, process.env, { channel: buildChannel });
const manifestVersion = resolveManifestVersion(appVersion);
const isLocal = buildChannel === "local";
const extensionName = isLocal ? "FreeAnima Vault Local" : "FreeAnima Vault";

/** FreeAnima Vault 浏览器扩展（MV3；Chrome） */
export default defineConfig({
  srcDir: "src/portal/extension",
  outDir: "dist/browser-extension",
  publicDir: "src/portal/extension/public",
  modules: [],
  manifest: {
    name: extensionName,
    description: "FreeAnima 用户保险库：自动填充、生成密码、连接 Habitat",
    version: manifestVersion,
    version_name: appVersion,
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    permissions: ["storage", "activeTab", "tabs", "contextMenus", "scripting", "notifications"],
    host_permissions: ["http://*/*", "https://*/*"],
    commands: {
      "autofill-login": {
        suggested_key: { default: "Ctrl+Shift+L" },
        description: "自动填充当前页登录凭据",
      },
      "open-popup": {
        suggested_key: { default: "Ctrl+Shift+Y" },
        description: "打开 Vault 弹窗",
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
  },
  vite: () => ({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: buildViteAliases({ repoRoot }),
    },
  }),
});
