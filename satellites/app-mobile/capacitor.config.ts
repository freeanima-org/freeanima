import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.freeanima.app",
  appName: "FreeAnima",
  webDir: "www",
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: "http",
  },
};

export default config;
