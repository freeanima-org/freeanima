import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = join(import.meta.dir, "app");
const DIST_DIR = join(import.meta.dir, "dist");
const HTML_NAME = "index.html";

export async function buildCompanionApp(opts?: {
  watch?: boolean;
  minify?: boolean;
}): Promise<string> {
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
    plugins: [tailwind],
    ...(opts?.watch
      ? {
          watch: {
            onRebuild(rebuild: { success: boolean }) {
              if (!rebuild.success) {
                console.error("[companion] rebuild failed");
              }
            },
          },
        }
      : {}),
    alias: {
      "@shared": join(import.meta.dir, "shared"),
    },
  } as Bun.BuildConfig);

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
  void buildCompanionApp({ minify: false }).then((dir) => {
    console.log(`built companion UI -> ${dir}`);
  });
}
