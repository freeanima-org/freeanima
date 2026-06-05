import { getRepoRoot } from "./root-version.ts";

/** monorepo 根目录 */
export const REPO_ROOT = getRepoRoot();

/** 静态路由与 redirect 须一致 */
export const WEBUI_BASE_PATH = "/webui";
