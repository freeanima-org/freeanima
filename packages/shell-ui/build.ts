import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compileParaglideToDir } from "@freeanima/admin-frontend/paraglide-compile";

const PKG_DIR = import.meta.dir;
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "dist");
const HTML_NAME = "index.html";

const CHAT_APP_SRC = join(REPO_ROOT, "satellites", "chat", "app", "src");
const COMPANION_APP_SRC = join(REPO_ROOT, "satellites", "companion", "app", "src");
const ADMIN_APP_SRC = join(REPO_ROOT, "platform", "admin-frontend", "app", "src");
const SHELL_APP_SRC = join(APP_DIR, "src");

function createAliasPlugin(paraglideDir: string): import("bun").BunPlugin {
  return {
    name: "shell-ui-resolve",
    setup(build) {
      build.onResolve({ filter: /messages\/paraglide\// }, (args) => {
        const rel = args.path.replace(/^.*messages\/paraglide\//, "");
        return { path: join(paraglideDir, rel) };
      });
      build.onResolve({ filter: /^@\// }, (args) => {
        const importer = args.importer.replace(/\\/g, "/");
        let base = SHELL_APP_SRC;
        if (importer.includes("/satellites/chat/")) base = CHAT_APP_SRC;
        else if (importer.includes("/satellites/companion/")) base = COMPANION_APP_SRC;
        else if (importer.includes("/admin-frontend/")) base = ADMIN_APP_SRC;
        return { path: join(base, args.path.slice(2)) };
      });
      build.onResolve({ filter: /^@shared\// }, (args) => {
        return {
          path: join(
            REPO_ROOT,
            "satellites",
            "companion",
            "shared",
            args.path.slice("@shared/".length),
          ),
        };
      });
    },
  };
}

export async function buildShellUi(opts?: { watch?: boolean; minify?: boolean }): Promise<string> {
  const paraglideDir = join(DIST_DIR, ".paraglide");
  compileParaglideToDir({ projectRoot: REPO_ROOT, outdir: paraglideDir });
  rmSync(join(DIST_DIR, HTML_NAME), { force: true });
  mkdirSync(DIST_DIR, { recursive: true });

  const tailwindMod = await import("bun-plugin-tailwind");
  const tailwind = tailwindMod.default;

  const result = await Bun.build({
    entrypoints: [join(APP_DIR, HTML_NAME)],
    outdir: DIST_DIR,
    target: "browser",
    minify: opts?.minify ?? false,
    publicPath: "/",
    plugins: [createAliasPlugin(paraglideDir), tailwind],
    ...(opts?.watch
      ? {
          watch: {
            onRebuild(rebuild: { success: boolean }) {
              if (!rebuild.success) console.error("[shell-ui] rebuild failed");
            },
          },
        }
      : {}),
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }

  const html = join(DIST_DIR, HTML_NAME);
  if (!existsSync(html)) throw new Error("build did not produce index.html");
  const content = readFileSync(html, "utf-8");
  if (!content.includes("root")) throw new Error("invalid build output");
  return DIST_DIR;
}

if (import.meta.main) {
  void buildShellUi({ minify: true }).then((dir) => {
    console.log(`built shell-ui -> ${dir}`);
  });
}
