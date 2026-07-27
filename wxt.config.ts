import { defineConfig } from "wxt";
import path from "node:path";

/** FreeAnima Vault 浏览器扩展（MV3；Chrome） */
export default defineConfig({
  srcDir: "src/portal/extension",
  outDir: "dist/browser-extension",
  publicDir: "src/portal/extension/public",
  modules: [],
  manifest: {
    name: "FreeAnima Vault",
    description: "FreeAnima 用户保险库：自动填充、生成密码、连接 Habitat",
    version: "0.1.0",
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
      default_title: "FreeAnima Vault",
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
    resolve: {
      alias: {
        "@freeanima": path.resolve(import.meta.dirname, "src"),
      },
    },
  }),
});
