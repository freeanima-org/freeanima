#!/usr/bin/env bun
/**
 * Build @freeanima/cli publish directory (cli/publish/):
 * - dist/cli.js single-file bundle
 * - connectors/webui/app/ Bun fullstack static assets
 * - migrations/ PG migrations
 */
import { $ } from "bun";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CLI_DIR = join(ROOT, "cli");
const PUBLISH_DIR = join(CLI_DIR, "publish");
const ROOT_PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
  version: string;
};

/** Bun bundle bakes tiktoken's build-time __dirname; rewrite to load dist/tiktoken_bg.wasm at runtime. */
const TIKTOKEN_WASM_LOADER_RE =
  /KnH=__dirname\.split\(RK\.sep\)\.reduce\(\(H,\$,A,L\)=>\{let D=L\.slice\(0,A\+1\)\.join\(RK\.sep\)\+RK\.sep;if\(!D\.includes\("node_modules"\+RK\.sep\)\)H\.unshift\(RK\.join\(D,"node_modules","tiktoken","","\.\/tiktoken_bg\.wasm"\)\);return H\},\[\]\);KnH\.unshift\(RK\.join\(__dirname,"\.\/tiktoken_bg\.wasm"\)\);for\(let H of KnH\)try\{Q5H=BFA\.readFileSync\(H\);break\}catch\{\}/;

const TIKTOKEN_WASM_LOADER_PATCH =
  'KnH=[RK.join(process.env.FREEANIMA_REPO_ROOT?RK.join(process.env.FREEANIMA_REPO_ROOT,"dist"):RK.dirname(import.meta.path),"tiktoken_bg.wasm")];for(let H of KnH)try{Q5H=BFA.readFileSync(H);break}catch{}';

function patchTiktokenWasmLoader(bundlePath: string): void {
  const src = readFileSync(bundlePath, "utf-8");
  if (!TIKTOKEN_WASM_LOADER_RE.test(src)) {
    throw new Error(
      "build-cli: tiktoken wasm loader pattern not found; bun bundle layout may have changed",
    );
  }
  writeFileSync(bundlePath, src.replace(TIKTOKEN_WASM_LOADER_RE, TIKTOKEN_WASM_LOADER_PATCH));
}

function resolveTiktokenWasmPath(): string {
  const require = createRequire(join(ROOT, "core/package.json"));
  const tiktokenDir = dirname(require.resolve("tiktoken/package.json"));
  return join(tiktokenDir, "tiktoken_bg.wasm");
}

async function main(): Promise<void> {
  rmSync(PUBLISH_DIR, { recursive: true, force: true });
  mkdirSync(join(PUBLISH_DIR, "dist"), { recursive: true });
  mkdirSync(join(PUBLISH_DIR, "connectors/webui"), { recursive: true });

  console.log("bundling cli…");
  const bundlePath = join(PUBLISH_DIR, "dist/cli.js");
  await $`bun build ${join(CLI_DIR, "src/cli.ts")} --outdir ${join(PUBLISH_DIR, "dist")} --target bun --minify`;

  console.log("patching tiktoken wasm loader…");
  patchTiktokenWasmLoader(bundlePath);
  cpSync(resolveTiktokenWasmPath(), join(PUBLISH_DIR, "dist/tiktoken_bg.wasm"));

  console.log("copying migrations…");
  cpSync(join(ROOT, "core/migrations"), join(PUBLISH_DIR, "migrations"), {
    recursive: true,
  });

  console.log("copying webui app…");
  cpSync(join(ROOT, "platform/connectors/webui/app"), join(PUBLISH_DIR, "connectors/webui/app"), {
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
    description: "FreeAnima CLI (Bun runtime)",
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
      // Must match npm publishConfig.registry (trailing slash included), or OIDC auth is skipped
      registry: "https://registry.npmjs.org/",
    },
  };

  writeFileSync(join(PUBLISH_DIR, "package.json"), `${JSON.stringify(publishPkg, null, 2)}\n`);

  console.log(`publish dir ready: ${PUBLISH_DIR} (@freeanima/cli@${ROOT_PKG.version})`);
}

await main();
