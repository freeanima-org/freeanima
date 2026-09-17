#!/usr/bin/env bun
/**
 * `cordis.yml`（运行期加载的插件树）与 TS 侧插件清单必须一致。
 *
 * 校验四件事：
 *   1. `cordis.yml` 里每条 `name:` 的插件文件存在；
 *   2. 每个 `packages/features/<slug>/cordis-plugin.ts` 都在 `cordis.yml` 中；
 *   3. `platform/features/builtin-feature-plugins.ts` 的 feature 清单 == feature 插件文件集合；
 *   4. `platform/boot/phases.ts` 的启动阶段插件 == `cordis.yml` 前 N 条。
 *
 * 只做源码文本比对（不 import 插件树），避免拉起整条 boot 依赖链。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const CORDIS_YML = join(REPO_ROOT, "cordis.yml");
const FEATURES_DIR = join(REPO_ROOT, "packages/features");
const BUILTIN_PLUGINS = join(REPO_ROOT, "packages/server/features/builtin-feature-plugins.ts");
const PHASES = join(REPO_ROOT, "packages/server/boot/phases.ts");

const problems: string[] = [];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** `cordis.yml` 中按顺序出现的插件路径。 */
function cordisPluginPaths(): string[] {
  const out: string[] = [];
  for (const line of read(CORDIS_YML).split("\n")) {
    const match = /^\s*-\s*name:\s*(\S+)\s*$/.exec(line);
    if (match?.[1]) out.push(match[1]);
  }
  return out;
}

const declared = cordisPluginPaths();
if (declared.length === 0) problems.push("cordis.yml 未解析到任何 name: 插件路径");

for (const rel of declared) {
  if (!existsSync(join(REPO_ROOT, rel))) problems.push(`cordis.yml 指向不存在的插件：${rel}`);
}

const featureSlugs = readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => existsSync(join(FEATURES_DIR, slug, "cordis-plugin.ts")))
  .toSorted();

const declaredFeatureSlugs = declared
  .map((rel) => /^\.\/packages\/features\/([^/]+)\/cordis-plugin\.ts$/.exec(rel)?.[1])
  .filter((slug): slug is string => Boolean(slug))
  .toSorted();

for (const slug of featureSlugs) {
  if (!declaredFeatureSlugs.includes(slug)) {
    problems.push(`feature 插件未挂载到 cordis.yml：packages/features/${slug}/cordis-plugin.ts`);
  }
}
for (const slug of declaredFeatureSlugs) {
  if (!featureSlugs.includes(slug)) {
    problems.push(`cordis.yml 挂载了不存在 cordis-plugin.ts 的 feature：${slug}`);
  }
}

/** `builtin-feature-plugins.ts` 中 import 的 feature 插件路径。 */
function builtinImportPaths(): string[] {
  const out: string[] = [];
  for (const match of read(BUILTIN_PLUGINS).matchAll(
    /from "(@freeanima\/features\/[^"]+cordis-plugin\.ts)"/g,
  )) {
    if (match[1]) out.push(match[1]);
  }
  return out;
}

const builtinSlugs = builtinImportPaths()
  .map((spec) => /^@freeanima\/features\/([^/]+)\/cordis-plugin\.ts$/.exec(spec)?.[1])
  .filter((slug): slug is string => Boolean(slug))
  .toSorted();

for (const slug of featureSlugs) {
  if (!builtinSlugs.includes(slug)) {
    problems.push(`feature 插件未列入 builtin-feature-plugins.ts：${slug}`);
  }
}
for (const slug of builtinSlugs) {
  if (!featureSlugs.includes(slug)) {
    problems.push(`builtin-feature-plugins.ts 列了不存在的 feature 插件：${slug}`);
  }
}

/** `phases.ts` 中 `./plugins/<name>.ts` 的启动阶段插件。 */
const bootPlugins = [...read(PHASES).matchAll(/from "\.\/plugins\/([a-z-]+)\.ts"/g)].map(
  (match) => `./packages/server/boot/plugins/${match[1]}.ts`,
);

const declaredBoot = declared.filter((rel) => rel.includes("/boot/plugins/"));
for (const rel of bootPlugins) {
  if (!declared.includes(rel)) problems.push(`启动阶段插件未挂载到 cordis.yml：${rel}`);
}
for (const rel of declaredBoot) {
  if (!bootPlugins.includes(rel))
    problems.push(`cordis.yml 挂载了 phases.ts 未声明的启动插件：${rel}`);
}

if (problems.length > 0) {
  console.error("check-boot-plugin-parity: 失败");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `check-boot-plugin-parity: ok（${declared.length} 条：${declaredBoot.length} 启动阶段 + ${declaredFeatureSlugs.length} feature + 其余）`,
);
