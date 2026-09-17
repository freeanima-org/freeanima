import { getRepoRoot } from "@freeanima/server/config";
import { HABITAT_BASE_PATH } from "@freeanima/capabilities/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { HABITAT_BASE_PATH };
