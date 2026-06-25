import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.freeanima.app",
  appName: "FreeAnima",
  webDir: "www",
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
  },
};

export default config;
