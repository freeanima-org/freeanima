import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.freeanima.app",
  appName: "FreeAnima",
  webDir: "www",
  backgroundColor: "#1d232a",
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
    adjustMarginsForEdgeToEdge: "auto",
  },
  server: {
    androidScheme: "https",
    // bootstrap 远程 UI：允许 WebView 内导航到用户配置的 Hub（否则系统浏览器打开）
    allowNavigation: ["*"],
  },
};

export default config;
