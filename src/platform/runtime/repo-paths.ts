import { getRepoRoot } from "@freeanima/platform/config";
import { HABITAT_BASE_PATH } from "@freeanima/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { HABITAT_BASE_PATH };
