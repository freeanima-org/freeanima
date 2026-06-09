#!/usr/bin/env bun
/**
 * 构建 @freeanima/cli 发布目录（cli/publish/）：
 * - dist/cli.js 单体 bundle
 * - connectors/webui/app/ Bun fullstack 静态资源
 * - migrations/ PG 迁移
 */
import { $ } from "bun";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CLI_DIR = join(ROOT, "cli");
const PUBLISH_DIR = join(CLI_DIR, "publish");
const ROOT_PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
  version: string;
};

async function main(): Promise<void> {
  rmSync(PUBLISH_DIR, { recursive: true, force: true });
  mkdirSync(join(PUBLISH_DIR, "dist"), { recursive: true });
  mkdirSync(join(PUBLISH_DIR, "connectors/webui"), { recursive: true });

  console.log("bundling cli…");
  await $`bun build ${join(CLI_DIR, "src/cli.ts")} --outdir ${join(PUBLISH_DIR, "dist")} --target bun --minify`;

  console.log("copying migrations…");
  cpSync(join(ROOT, "engine/db/migrations"), join(PUBLISH_DIR, "migrations"), {
    recursive: true,
  });

  console.log("copying webui app…");
  cpSync(join(ROOT, "connectors/webui/app"), join(PUBLISH_DIR, "connectors/webui/app"), {
    recursive: true,
  });

  const binScript = `#!/usr/bin/env bun
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.env.FREEANIMA_REPO_ROOT = root;
await import(join(root, "dist/cli.js"));
`;

  writeFileSync(join(PUBLISH_DIR, "dist/anima"), binScript, { mode: 0o755 });

  const publishPkg = {
    name: "@freeanima/cli",
    version: ROOT_PKG.version,
    description: "逸灵风 FreeAnima CLI（Bun 运行时）",
    type: "module",
    engines: { bun: ">=1.3.14" },
    bin: { anima: "./dist/anima" },
    files: ["dist", "migrations", "connectors"],
    repository: {
      type: "git",
      url: "git+https://github.com/freeanima-org/freeanima.git",
    },
    publishConfig: {
      access: "public",
      // 须与 @semantic-release/npm OFFICIAL_REGISTRY 一致（含尾斜杠），否则 OIDC 鉴权被跳过
      registry: "https://registry.npmjs.org/",
    },
  };

  writeFileSync(join(PUBLISH_DIR, "package.json"), `${JSON.stringify(publishPkg, null, 2)}\n`);

  console.log(`publish dir ready: ${PUBLISH_DIR} (@freeanima/cli@${ROOT_PKG.version})`);
}

await main();
