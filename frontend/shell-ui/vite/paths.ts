import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VITE_DIR = dirname(fileURLToPath(import.meta.url));
export const SHELL_UI_DIR = join(VITE_DIR, "..");
export const REPO_ROOT = join(SHELL_UI_DIR, "..", "..");

export function shellSourcePaths(root = REPO_ROOT) {
  return {
    chat: join(root, "features", "chat", "ui", "app", "src"),
    task: join(root, "features", "task", "ui", "app", "src"),
    diary: join(root, "features", "diary", "ui", "app", "src"),
    dream: join(root, "features", "dream", "ui", "app", "src"),
    console: join(root, "features", "console", "ui", "console"),
    shell: join(root, "frontend", "shell-ui", "app", "src"),
    pair: join(root, "satellites", "pair-programming", "app", "src"),
    companionApp: join(root, "satellites", "companion", "app", "src"),
    companionShared: join(root, "satellites", "companion", "shared"),
  };
}
