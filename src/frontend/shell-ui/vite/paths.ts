import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VITE_DIR = dirname(fileURLToPath(import.meta.url));
export const SHELL_UI_DIR = join(VITE_DIR, "..");
export const REPO_ROOT = join(SHELL_UI_DIR, "..", "..", "..");

export function shellSourcePaths(root = REPO_ROOT) {
  return {
    chat: join(root, "src/features", "chat", "ui", "spa"),
    task: join(root, "src/features", "task", "ui", "spa"),
    diary: join(root, "src/features", "diary", "ui", "spa"),
    dream: join(root, "src/features", "dream", "ui", "spa"),
    console: join(root, "src/features", "console", "ui", "console"),
    shell: join(root, "src/frontend", "shell-ui", "spa"),
    companionApp: join(root, "src/satellites", "companion", "spa"),
    companionShared: join(root, "src/satellites", "companion", "shared"),
  };
}
