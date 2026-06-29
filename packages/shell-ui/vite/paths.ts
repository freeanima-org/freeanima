import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VITE_DIR = dirname(fileURLToPath(import.meta.url));
export const SHELL_UI_DIR = join(VITE_DIR, "..");
export const REPO_ROOT = join(SHELL_UI_DIR, "..", "..");

export function shellSourcePaths(root = REPO_ROOT) {
  return {
    chat: join(root, "satellites", "chat", "app", "src"),
    task: join(root, "satellites", "task", "app", "src"),
    admin: join(root, "platform", "admin-frontend", "app", "src"),
    shell: join(root, "packages", "shell-ui", "app", "src"),
    pair: join(root, "satellites", "pair-programming", "app", "src"),
    companionApp: join(root, "satellites", "companion", "app", "src"),
    companionShared: join(root, "satellites", "companion", "shared"),
    sapWorkerEntry: join(root, "packages", "sap-contract", "src", "shared-worker-entry.ts"),
  };
}
