import { getRepoRoot } from "@freeanima/platform/config";
import { WEBUI_BASE_PATH } from "@freeanima/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { WEBUI_BASE_PATH };
