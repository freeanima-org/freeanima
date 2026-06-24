import { getRepoRoot } from "@freeanima/platform/config";
import { ADMIN_BASE_PATH } from "@freeanima/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { ADMIN_BASE_PATH };
