"use strict";

const { createRequire } = require("node:module");
const { join, dirname } = require("node:path");

/** Linux 交叉打 NSIS 时跳过 Wine，改用 UninstallerReader（须在 electron-builder 加载前执行） */
if (process.platform === "linux") {
  const shellRoot = dirname(__filename);
  const requireShell = createRequire(join(shellRoot, "package.json"));
  const requireEb = createRequire(requireShell.resolve("electron-builder"));
  const macosVersion = requireEb("app-builder-lib/out/util/macosVersion");
  macosVersion.isMacOsCatalina = () => true;
}
