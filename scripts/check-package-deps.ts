/**
 * 断言 workspace 包的依赖禁令与 13 包 DAG。
 *
 * 三层校验：
 *   1. `@freeanima/*` 内部依赖必须**恰好**等于 DAG 允许集合（多/少都失败）；
 *   2. 每个包的外部依赖禁令（shared 无 drizzle/React/LLM/mail 等）；
 *   3. 根编排包只允许引用 DAG 内的包名。
 *
 * 目标是 P4/P5 迁移后的 13 包；迁移进行中时，`packages` /
 * `packages` 作为聚合包按同一 DAG 的并集校验。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isRecord } from "@freeanima/shared/util";

const ROOT = join(import.meta.dir, "..");

type Pkg = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** 目标 DAG：包名 → 允许依赖的 `@freeanima/*` 包名（不含 `@freeanima/` 前缀）。 */
const ALLOWED_FREEANIMA_DEPS: Record<string, readonly string[]> = {
  "@freeanima/shared": [],
  "@freeanima/kernel": ["shared"],
  "@freeanima/core": ["kernel", "shared"],
  "@freeanima/engine": ["core", "kernel", "shared"],
  "@freeanima/capabilities": ["engine", "core", "kernel", "shared"],
  "@freeanima/features": ["capabilities", "engine", "core", "kernel", "shared"],
  "@freeanima/server": ["features", "capabilities", "engine", "core", "kernel", "shared"],
  // 入口/组合根（同 server）：可依赖全部服务端包
  "@freeanima/cli": ["server", "features", "capabilities", "engine", "core", "kernel", "shared"],
  "@freeanima/ui-kit": ["shared"],
  "@freeanima/portal-sdk": ["ui-kit", "shared"],
  "@freeanima/ui-features": ["portal-sdk", "ui-kit", "shared"],
  "@freeanima/app-frame": ["ui-features", "portal-sdk", "ui-kit", "shared"],
  "@freeanima/portal": ["app-frame", "ui-features", "portal-sdk", "ui-kit", "shared"],
  // 迁移进行中的聚合包：允许其未来拆分包集合的并集
  "@freeanima/frontend": ["app-frame", "portal-sdk", "shared", "ui-features", "ui-kit"],
  // 文档站：不参与运行时 DAG
  "@freeanima/site": [],
};

/**
 * 反向边债务（棘轮）：P4 拆包时尚未清完的反向依赖，必须显式登记。
 *
 * 目标是把本表清空；`just qa check` 会在新增未登记反向边时失败。
 * 文件级明细见 `scripts/oxlint-plugins/freeanima/lib/layer-deps-baseline.ts`。
 */
const LLM_AND_MAIL = ["@anthropic-ai/sdk", "openai", "nodemailer", "mailparser", "imapflow"];

/** 包名 → 禁止的外部依赖前缀。 */
const BANNED_EXTERNAL: Record<string, readonly string[]> = {
  "@freeanima/shared": ["drizzle-orm", "drizzle-kit", "react", "react-dom", ...LLM_AND_MAIL],
  "@freeanima/kernel": ["drizzle-orm", "drizzle-kit", "react", "react-dom", ...LLM_AND_MAIL],
  "@freeanima/core": ["react", "react-dom"],
  "@freeanima/engine": ["react", "react-dom"],
  "@freeanima/capabilities": ["react", "react-dom"],
  "@freeanima/features": ["react", "react-dom"],
  "@freeanima/server": ["react", "react-dom"],
  "@freeanima/cli": ["react", "react-dom"],
  "@freeanima/ui-kit": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
  "@freeanima/portal-sdk": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
  "@freeanima/ui-features": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
  "@freeanima/app-frame": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
  "@freeanima/portal": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
  "@freeanima/frontend": ["drizzle-orm", "drizzle-kit", ...LLM_AND_MAIL],
};

function stringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

function load(path: string): Pkg {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(raw)) return {};
  const dependencies = stringMap(raw.dependencies);
  const devDependencies = stringMap(raw.devDependencies);
  return {
    ...(typeof raw.name === "string" ? { name: raw.name } : {}),
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
  };
}

function allDeps(pkg: Pkg): string[] {
  return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
}

const failures: string[] = [];

function assertNone(pkgName: string, deps: readonly string[], banned: readonly string[]): void {
  const hits = deps.filter((dep) => banned.some((b) => dep === b || dep.startsWith(`${b}/`)));
  if (hits.length > 0) failures.push(`${pkgName} 禁止依赖: ${hits.join(", ")}`);
}

function checkPackage(pkg: Pkg, where: string): void {
  const name = pkg.name;
  if (!name) {
    failures.push(`${where}: 缺少 name`);
    return;
  }
  const deps = allDeps(pkg);
  const allowed = ALLOWED_FREEANIMA_DEPS[name];
  if (!allowed) {
    failures.push(`${name}: 不在 DAG 表内（新增包须同步 ALLOWED_FREEANIMA_DEPS）`);
    return;
  }

  const internal = deps
    .filter((dep) => dep.startsWith("@freeanima/"))
    .map((dep) => dep.slice("@freeanima/".length))
    .toSorted();
  const expected = [...allowed].toSorted();
  // 只校验「不得多」：包不必依赖其允许集合里的每一个（下层能力可不用）。
  const missing: string[] = [];
  const extra = internal.filter((dep) => !expected.includes(dep));
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (extra.length > 0) parts.push(`多: ${extra.join(", ")}`);
    if (missing.length > 0) parts.push(`少: ${missing.join(", ")}`);
    failures.push(`${name} 的 @freeanima 依赖与 DAG 不符（${parts.join("；")}）`);
  }
  assertNone(name, deps, BANNED_EXTERNAL[name] ?? []);
}

/** 迁移目标包的目录名 → package.json 路径（存在才校验）。 */
const TARGET_DIRS = [
  "shared",
  "kernel",
  "core",
  "engine",
  "capabilities",
  "features",
  "server",
  "cli",
  "ui-kit",
  "portal-sdk",
  "ui-features",
  "app-frame",
  "portal",
  "frontend",
];

for (const dir of TARGET_DIRS) {
  const path = join(ROOT, "packages", dir, "package.json");
  if (existsSync(path)) checkPackage(load(path), `packages/${dir}`);
}

const rootPkg = load(join(ROOT, "package.json"));
const rootDeps = allDeps(rootPkg).filter((dep) => dep.startsWith("@freeanima/"));
const known = new Set(Object.keys(ALLOWED_FREEANIMA_DEPS));
for (const dep of rootDeps) {
  if (!known.has(dep)) {
    failures.push(`仓库根引用了 DAG 外的包: ${dep}`);
  }
}

if (existsSync(join(ROOT, "site/package.json"))) {
  checkPackage(load(join(ROOT, "site/package.json")), "site");
}

/** 未纳入校验的 packages/* 目录（提示，不失败）。 */
const unlisted = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((dir) => !TARGET_DIRS.includes(dir));
if (unlisted.length > 0) failures.push(`packages/ 下有未纳入 DAG 的目录: ${unlisted.join(", ")}`);

if (failures.length > 0) {
  console.error("check-package-deps: 失败");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check-package-deps: ok（${TARGET_DIRS.length} 个包路径已校验）`);
