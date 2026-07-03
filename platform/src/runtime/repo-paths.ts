import { getRepoRoot } from "@freeanima/platform/config";
import { CONSOLE_BASE_PATH } from "@freeanima/platform/ports/constants";

/** Monorepo root directory */
export const REPO_ROOT = getRepoRoot();

export { CONSOLE_BASE_PATH };
