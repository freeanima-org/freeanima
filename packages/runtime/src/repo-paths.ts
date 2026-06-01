import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** monorepo 根目录（packages/runtime 向上两级） */
const RUNTIME_PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = join(RUNTIME_PKG_ROOT, "..", "..");

export const WEBUI_DIST = join(REPO_ROOT, "apps", "webui", "dist");

export const WEBUI_DIST_INDEX = join(WEBUI_DIST, "index.html");
