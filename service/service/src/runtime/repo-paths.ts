import { getRepoRoot } from "@freeanima/service-config";
import { WEBUI_BASE_PATH } from "@freeanima/service-api/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { WEBUI_BASE_PATH };
