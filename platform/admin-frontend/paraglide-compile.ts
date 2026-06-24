import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export const BUNDLED_PARAGLIDE_REL = join("messages", "paraglide");

/** Published @freeanima/cli: messages/paraglide（build-cli 预编译） */
export function resolveBundledParaglideDir(repoRoot: string): string | null {
  const dir = join(repoRoot, BUNDLED_PARAGLIDE_REL);
  if (existsSync(join(dir, "runtime.js"))) return dir;
  return null;
}

export function compileParaglideToDir(opts: {
  projectRoot: string;
  outdir: string;
  clean?: boolean;
}): string {
  const { projectRoot, outdir, clean = true } = opts;
  if (clean) rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const result = spawnSync(
    "bun",
    [
      "x",
      "@inlang/paraglide-js",
      "compile",
      "--project",
      join(projectRoot, "project.inlang"),
      "--outdir",
      outdir,
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `paraglide compile failed: ${result.stderr || result.stdout || "unknown error"}`,
    );
  }
  return outdir;
}
