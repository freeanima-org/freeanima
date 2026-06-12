#!/usr/bin/env bun
/**
 * Phase 3: merge storage/* + mechanism/* (11 packages) into @freeanima/core.
 * Run from repo root: bun scripts/merge-storage-mechanism-to-core.ts
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

const IMPORT_REPLACEMENTS: [string, string][] = [
  [
    "@freeanima/core/tool/session-conversation-port",
    "@freeanima/core/tool/session-conversation-port",
  ],
  ["@freeanima/core/hooks/prompt", "@freeanima/core/hooks/prompt"],
  ["@freeanima/core/hooks/conversation", "@freeanima/core/hooks/conversation"],
  ["@freeanima/core/hooks/loop", "@freeanima/core/hooks/loop"],
  ["@freeanima/core/provider", "@freeanima/core/provider"],
  ["@freeanima/core/tokenizer", "@freeanima/core/tokenizer"],
  ["@freeanima/core/compress", "@freeanima/core/compress"],
  ["@freeanima/core/hooks", "@freeanima/core/hooks"],
  ["@freeanima/core/skill", "@freeanima/core/skill"],
  ["@freeanima/core/tool", "@freeanima/core/tool"],
  ["@freeanima/core/llm", "@freeanima/core/llm"],
  ["@freeanima/core/config", "@freeanima/core/config"],
  ["@freeanima/core/repos", "@freeanima/core/repos"],
  ["@freeanima/core/util", "@freeanima/core/util"],
  ["@freeanima/core/db", "@freeanima/core/db"],
];

const OLD_PKG_PREFIXES = [
  "storage-db",
  "storage-repos",
  "storage-config",
  "storage-util",
  "storage-tokenizer",
  "storage-provider-llm",
  "mechanism-tool",
  "mechanism-llm",
  "mechanism-compress",
  "mechanism-hooks",
  "mechanism-skill",
];

const MODULE_DIRS: [string, string][] = [
  ["storage/db/src", "db"],
  ["storage/repos/src", "repos"],
  ["storage/config/src", "config"],
  ["storage/util/src", "util"],
  ["storage/tokenizer/src", "tokenizer"],
  ["storage/provider-llm/src", "provider"],
  ["mechanism/tool/src", "tool"],
  ["mechanism/llm/src", "llm"],
  ["mechanism/compress/src", "compress"],
  ["mechanism/hooks/src", "hooks"],
  ["mechanism/skill/src", "skill"],
];

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyDir(src, dst);
    else cpSync(src, dst);
  }
}

function replaceInContent(content: string): string {
  let out = content;
  for (const [from, to] of IMPORT_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

function walkFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walkFiles(abs, out);
    else if (/\.(ts|tsx|json|md|mdc|sql)$/.test(name)) out.push(abs);
  }
}

function patchPackageJson(abs: string): void {
  const pj = JSON.parse(readFileSync(abs, "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const key of ["dependencies", "devDependencies"] as const) {
    const deps = pj[key];
    if (!deps) continue;
    for (const dep of Object.keys({ ...deps })) {
      const root = dep.replace("@freeanima/", "").split("/")[0] ?? "";
      if (OLD_PKG_PREFIXES.includes(root)) delete deps[dep];
    }
    if (key === "dependencies" && Object.keys(deps).length > 0) {
      deps["@freeanima/core"] = "workspace:*";
    }
    pj[key] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  }
  writeFileSync(abs, JSON.stringify(pj, null, 2) + "\n");
}

function main(): void {
  const coreRoot = join(ROOT, "core");
  const coreSrc = join(coreRoot, "src");
  rmSync(coreRoot, { recursive: true, force: true });
  mkdirSync(coreSrc, { recursive: true });

  for (const [fromRel, sub] of MODULE_DIRS) {
    copyDir(join(ROOT, fromRel), join(coreSrc, sub));
  }

  // drizzle migrations + config from storage/db
  for (const extra of ["drizzle", "drizzle.config.ts"]) {
    const src = join(ROOT, "storage/db", extra);
    if (existsSync(src)) {
      const dst = join(coreRoot, extra);
      if (statSync(src).isDirectory()) copyDir(src, dst);
      else cpSync(src, dst);
    }
  }

  writeFileSync(
    join(coreRoot, "package.json"),
    JSON.stringify(
      {
        name: "@freeanima/core",
        type: "module",
        scripts: {
          "db:generate": "drizzle-kit generate",
          "db:migrate": "drizzle-kit migrate",
        },
        exports: {
          "./config": "./src/config/index.ts",
          "./config/*": "./src/config/*.ts",
          "./db": "./src/db/index.ts",
          "./db/schema": "./src/db/schema/index.ts",
          "./db/domain": "./src/db/domain/index.ts",
          "./db/domain/*": "./src/db/domain/*.ts",
          "./repos": "./src/repos/index.ts",
          "./repos/*": "./src/repos/*.ts",
          "./util": "./src/util/index.ts",
          "./util/*": "./src/util/*.ts",
          "./tokenizer": "./src/tokenizer/index.ts",
          "./tokenizer/*": "./src/tokenizer/*.ts",
          "./provider": "./src/provider/index.ts",
          "./provider/*": "./src/provider/*.ts",
          "./tool": "./src/tool/index.ts",
          "./tool/session-conversation-port": "./src/tool/session-conversation-port.ts",
          "./tool/*": "./src/tool/*.ts",
          "./llm": "./src/llm/index.ts",
          "./llm/*": "./src/llm/*.ts",
          "./compress": "./src/compress/index.ts",
          "./compress/*": "./src/compress/*.ts",
          "./hooks/loop": "./src/hooks/loop/index.ts",
          "./hooks/conversation": "./src/hooks/conversation/index.ts",
          "./hooks/prompt": "./src/hooks/prompt/index.ts",
          "./hooks/*": "./src/hooks/*.ts",
          "./skill": "./src/skill/index.ts",
          "./skill/*": "./src/skill/*.ts",
        },
        dependencies: {
          "@freeanima/kernel": "workspace:*",
          "@huggingface/tokenizers": "^0.1.3",
          "drizzle-orm": "catalog:",
          tiktoken: "^1.0.22",
          zod: "catalog:",
        },
        devDependencies: {
          "@freeanima/capabilities-llm-openai": "workspace:*",
          "@freeanima/runtime": "workspace:*",
          "@types/bun": "catalog:",
          "drizzle-kit": "catalog:",
        },
      },
      null,
      2,
    ) + "\n",
  );

  const files: string[] = [];
  walkFiles(ROOT, files);
  let n = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (rel.startsWith("storage/") || rel.startsWith("mechanism/")) continue;
    if (rel.startsWith("node_modules/")) continue;
    if (f.endsWith("package.json")) {
      patchPackageJson(f);
      n++;
      continue;
    }
    const orig = readFileSync(f, "utf-8");
    const next = replaceInContent(orig);
    if (next !== orig) {
      writeFileSync(f, next);
      n++;
    }
  }

  walkFiles(coreRoot, files);
  for (const f of files) {
    if (f.endsWith("package.json")) continue;
    const orig = readFileSync(f, "utf-8");
    const next = replaceInContent(orig);
    if (next !== orig) writeFileSync(f, next);
  }

  rmSync(join(ROOT, "storage"), { recursive: true, force: true });
  rmSync(join(ROOT, "mechanism"), { recursive: true, force: true });

  const rootPj = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
    workspaces: { packages: string[] };
  };
  rootPj.workspaces.packages = rootPj.workspaces.packages
    .filter((p: string) => p !== "storage/*" && p !== "mechanism/*")
    .concat(rootPj.workspaces.packages.includes("core") ? [] : ["core"]);
  writeFileSync(join(ROOT, "package.json"), JSON.stringify(rootPj, null, 2) + "\n");

  console.log(`updated ${n} files; removed storage/ mechanism/`);
  console.log("done — run: bun install && bun run check");
}

main();
