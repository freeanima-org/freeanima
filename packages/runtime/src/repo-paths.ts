import { join } from "node:path";
import { getRepoRoot } from "./root-version";

/** monorepo 根目录 */
export const REPO_ROOT = getRepoRoot();

export const WEBUI_ROOT = join(REPO_ROOT, "apps", "webui");
/** 静态路由与 redirect 须一致 */
export const WEBUI_BASE_PATH = "/webui";
