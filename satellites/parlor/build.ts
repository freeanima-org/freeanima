import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const APP_DIR = join(import.meta.dir, "app");
const DIST_DIR = join(import.meta.dir, "dist");
const HTML_NAME = "index.html";

function compileParaglide(outdir: string): void {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const result = spawnSync(
    "bun",
    [
      "x",
      "@inlang/paraglide-js",
      "compile",
      "--project",
      join(REPO_ROOT, "project.inlang"),
      "--outdir",
      outdir,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`paraglide compile failed: ${result.stderr || result.stdout}`);
  }
}

function createParaglidePlugin(paraglideDir: string): import("bun").BunPlugin {
  return {
    name: "paraglide-runtime",
    setup(build) {
      build.onResolve({ filter: /messages\/paraglide\// }, (args) => {
        const rel = args.path.replace(/^.*messages\/paraglide\//, "");
        return { path: join(paraglideDir, rel) };
      });
    },
  };
}

export async function buildParlorApp(opts?: {
  watch?: boolean;
  minify?: boolean;
}): Promise<string> {
  const paraglideDir = join(DIST_DIR, ".paraglide");
  compileParaglide(paraglideDir);
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
    plugins: [createParaglidePlugin(paraglideDir), tailwind],
    ...(opts?.watch
      ? {
          watch: {
            onRebuild(rebuild: { success: boolean }) {
              if (!rebuild.success) {
                console.error("[parlor] rebuild failed");
              }
            },
          },
        }
      : {}),
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }

  const html = join(DIST_DIR, HTML_NAME);
  if (!existsSync(html)) {
    throw new Error("build did not produce index.html");
  }
  const content = readFileSync(html, "utf-8");
  if (!content.includes("root")) {
    throw new Error("invalid build output");
  }
  return DIST_DIR;
}

if (import.meta.main) {
  void buildParlorApp({ minify: true }).then((dir) => {
    console.log(`built parlor UI -> ${dir}`);
  });
}
