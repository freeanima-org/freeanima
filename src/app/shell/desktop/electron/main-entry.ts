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
  void import("./main.ts");
}
