import { getRepoRoot } from "@freeanima/habitat/platform/config";
import { HABITAT_BASE_PATH } from "@freeanima/habitat/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { HABITAT_BASE_PATH };
