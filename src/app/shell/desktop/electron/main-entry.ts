import { app } from "electron";

const QUIT_FOR_INSTALL_ARG = "--quit-for-install";
const quitForInstall = process.argv.includes(QUIT_FOR_INSTALL_ARG);

if (quitForInstall) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock({ quitForInstall: true });
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
    app.on("second-instance", (_event, argv) => {
      if (argv.includes(QUIT_FOR_INSTALL_ARG)) app.exit(0);
    });
    void app.whenReady().then(() => app.exit(0));
  }
} else {
  // 须在 main 内任何 Habitat HTTPS/WSS 之前合并 OS CA（mkcert rootCA）
  void import("./trust-system-ca.ts").then(({ applyTrustSystemCaAtStartup }) => {
    applyTrustSystemCaAtStartup();
    return import("./main.ts");
  });
}
