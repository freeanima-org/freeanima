import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.freeanima.app",
  appName: "FreeAnima",
  webDir: "www",
  backgroundColor: "#1d232a",
  // stub package.json 无 dependencies；显式列出 Capacitor 原生插件供 cap sync 发现
  includePlugins: ["@capacitor/keyboard", "@capacitor/preferences"],
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
    adjustMarginsForEdgeToEdge: "auto",
  },
  server: {
    // http：bootstrap 可 fetch 局域网 HTTP Hub（CORS 允许 http://localhost）；https Hub 仍通过 location 整页跳转
    androidScheme: "http",
    // bootstrap 远程 UI：允许 WebView 内导航到用户配置的 Hub（否则系统浏览器打开）
    allowNavigation: ["*"],
  },
};

export default config;
