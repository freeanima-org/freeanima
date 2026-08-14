/**
 * 断言三分包 package.json 依赖禁令（P5 #17727）。
 * - shared：无 drizzle / React / LLM SDK / mail
 * - frontend：无 drizzle / LLM SDK / mail
 * - habitat：无 react / react-dom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Pkg = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function load(rel: string): Pkg {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Pkg;
}

function allDeps(pkg: Pkg): string[] {
  return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
}

function assertNone(pkgName: string, deps: string[], banned: string[]): void {
  const hits = deps.filter((d) => banned.some((b) => d === b || d.startsWith(`${b}/`)));
  if (hits.length > 0) {
    throw new Error(`${pkgName} 禁止依赖: ${hits.join(", ")}`);
  }
}

const shared = load("packages/shared/package.json");
const habitat = load("packages/habitat/package.json");
const frontend = load("packages/frontend/package.json");

assertNone("@freeanima/shared", allDeps(shared), [
  "drizzle-orm",
  "drizzle-kit",
  "react",
  "react-dom",
  "@anthropic-ai/sdk",
  "openai",
  "nodemailer",
  "mailparser",
  "imapflow",
]);

assertNone("@freeanima/frontend", allDeps(frontend), [
  "drizzle-orm",
  "drizzle-kit",
  "@anthropic-ai/sdk",
  "openai",
  "nodemailer",
  "mailparser",
  "imapflow",
]);

assertNone("@freeanima/habitat", allDeps(habitat), ["react", "react-dom"]);

if (frontend.dependencies?.["@freeanima/habitat"]) {
  throw new Error("@freeanima/frontend 不得依赖 @freeanima/habitat");
}
if (shared.dependencies?.["@freeanima/habitat"] || shared.dependencies?.["@freeanima/frontend"]) {
  throw new Error("@freeanima/shared 不得依赖 habitat/frontend");
}

console.log("check-package-deps: ok");
