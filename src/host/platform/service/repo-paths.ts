import { getRepoRoot } from "@freeanima/host/platform/config";
import { HABITAT_BASE_PATH } from "@freeanima/host/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { HABITAT_BASE_PATH };
