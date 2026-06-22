import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * satellites/companion 包根目录。
 * 开发期：server/ 的上一级；Electron 打包后：electron-dist/ 的上一级。
 * 勿用 import.meta.dir（Bun 专有，Electron Node 中为 undefined）。
 */
export function companionPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}
