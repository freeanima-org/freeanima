#!/usr/bin/env bun
/**
 * Phase 2: merge orchestration/* (5 packages) into @freeanima/runtime.
 * Run from repo root: bun scripts/merge-orchestration-to-runtime.ts
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
  ["@freeanima/runtime", "@freeanima/runtime"],
  ["@freeanima/runtime/conversation", "@freeanima/runtime/conversation"],
  ["@freeanima/runtime/session", "@freeanima/runtime/session"],
  ["@freeanima/runtime/turn", "@freeanima/runtime/turn"],
  ["@freeanima/runtime/loop", "@freeanima/runtime/loop"],
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
    else if (/\.(ts|tsx|json|md|mdc)$/.test(name)) out.push(abs);
  }
}

function patchFile(abs: string): void {
  const orig = readFileSync(abs, "utf-8");
  const next = replaceInContent(orig);
  if (next !== orig) writeFileSync(abs, next);
}

function main(): void {
  const runtimeSrc = join(ROOT, "runtime/src");
  rmSync(join(ROOT, "runtime"), { recursive: true, force: true });
  mkdirSync(runtimeSrc, { recursive: true });

  copyDir(join(ROOT, "orchestration/session/src"), join(runtimeSrc, "session"));
  copyDir(join(ROOT, "orchestration/turn/src"), join(runtimeSrc, "turn"));
  copyDir(join(ROOT, "orchestration/loop/src"), join(runtimeSrc, "loop"));
  copyDir(join(ROOT, "orchestration/conversation/src"), join(runtimeSrc, "conversation"));
  for (const name of readdirSync(join(ROOT, "orchestration/runtime/src"))) {
    cpSync(join(ROOT, "orchestration/runtime/src", name), join(runtimeSrc, name));
  }

  // loop/engine.ts → loop/loop-engine.ts
  const loopEngine = join(runtimeSrc, "loop/engine.ts");
  const loopEngineDst = join(runtimeSrc, "loop/loop-engine.ts");
  if (existsSync(loopEngine)) {
    writeFileSync(loopEngineDst, readFileSync(loopEngine, "utf-8"));
    rmSync(loopEngine);
    const loopIndex = join(runtimeSrc, "loop/index.ts");
    writeFileSync(
      loopIndex,
      readFileSync(loopIndex, "utf-8").replace("./engine.ts", "./loop-engine.ts"),
    );
    const loopEngineRunTest = join(runtimeSrc, "loop/engine-run.test.ts");
    if (existsSync(loopEngineRunTest)) {
      writeFileSync(
        loopEngineRunTest,
        readFileSync(loopEngineRunTest, "utf-8").replace("./engine.ts", "./loop-engine.ts"),
      );
    }
  }

  // conversation/index.ts: drop session/turn re-exports
  const convIndex = join(runtimeSrc, "conversation/index.ts");
  writeFileSync(
    convIndex,
    readFileSync(convIndex, "utf-8")
      .replace('export * from "@freeanima/runtime/session";\n', "")
      .replace('export * from "@freeanima/runtime/turn";\n', ""),
  );

  // conversation.ts: use relative imports for session/turn
  const convTs = join(runtimeSrc, "conversation/conversation.ts");
  writeFileSync(
    convTs,
    readFileSync(convTs, "utf-8")
      .replace("@freeanima/runtime/session", "../session/index.ts")
      .replace("@freeanima/runtime/turn", "../turn/index.ts"),
  );

  const convService = join(runtimeSrc, "conversation/conversation-service.ts");
  writeFileSync(
    convService,
    readFileSync(convService, "utf-8").replace("@freeanima/runtime/session", "../session/index.ts"),
  );

  const turnCompression = join(runtimeSrc, "turn/compression-orchestration.ts");
  writeFileSync(
    turnCompression,
    readFileSync(turnCompression, "utf-8").replace(
      "@freeanima/runtime/session",
      "../session/index.ts",
    ),
  );

  const turnRuntime = join(runtimeSrc, "turn/turn-runtime.ts");
  writeFileSync(
    turnRuntime,
    readFileSync(turnRuntime, "utf-8").replace("@freeanima/runtime/session", "../session/index.ts"),
  );

  writeFileSync(
    join(ROOT, "runtime/package.json"),
    JSON.stringify(
      {
        name: "@freeanima/runtime",
        type: "module",
        exports: {
          ".": "./src/index.ts",
          "./session": "./src/session/index.ts",
          "./session/*": "./src/session/*.ts",
          "./turn": "./src/turn/index.ts",
          "./turn/*": "./src/turn/*.ts",
          "./loop": "./src/loop/index.ts",
          "./loop/*": "./src/loop/*.ts",
          "./conversation": "./src/conversation/index.ts",
          "./conversation/*": "./src/conversation/*.ts",
        },
        dependencies: {
          "@freeanima/kernel": "workspace:*",
          "@freeanima/core/compress": "workspace:*",
          "@freeanima/core/hooks": "workspace:*",
          "@freeanima/core/llm": "workspace:*",
          "@freeanima/core/skill": "workspace:*",
          "@freeanima/core/tool": "workspace:*",
          "@freeanima/core/config": "workspace:*",
          "@freeanima/core/db": "workspace:*",
          "@freeanima/core/provider": "workspace:*",
          "@freeanima/core/repos": "workspace:*",
          "@freeanima/core/tokenizer": "workspace:*",
          "@freeanima/core/util": "workspace:*",
        },
        devDependencies: {
          "@types/bun": "catalog:",
        },
      },
      null,
      2,
    ) + "\n",
  );

  // Global import replacement (exclude orchestration/ — will be deleted)
  const files: string[] = [];
  walkFiles(ROOT, files);
  let n = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (rel.startsWith("orchestration/")) continue;
    if (rel.startsWith("node_modules/")) continue;
    const orig = readFileSync(f, "utf-8");
    const next = replaceInContent(orig);
    if (next !== orig) {
      writeFileSync(f, next);
      n++;
    }
  }
  console.log(`updated ${n} files outside orchestration/`);

  // Patch runtime internal files too
  walkFiles(join(ROOT, "runtime"), files);
  for (const f of files) patchFile(f);

  // Update root package.json workspaces
  const rootPj = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
    workspaces: { packages: string[] };
  };
  rootPj.workspaces.packages = rootPj.workspaces.packages
    .filter((p: string) => p !== "orchestration/*")
    .concat(rootPj.workspaces.packages.includes("runtime") ? [] : ["runtime"]);
  writeFileSync(join(ROOT, "package.json"), JSON.stringify(rootPj, null, 2) + "\n");

  // Update package.json deps in all packages
  for (const dir of [
    "storage",
    "mechanism",
    "capabilities",
    "connectors",
    "service",
    "tests",
    "cli",
  ]) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    const entries =
      dir === "cli" || dir === "tests"
        ? [{ isDirectory: () => true, name: "." }]
        : readdirSync(base, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgDir = dir === "cli" || dir === "tests" ? base : join(base, ent.name);
      const pjPath = join(pkgDir, "package.json");
      if (!existsSync(pjPath)) continue;
      patchFile(pjPath);
      if (dir === "cli" || dir === "tests") break;
    }
  }

  rmSync(join(ROOT, "orchestration"), { recursive: true, force: true });
  console.log("removed orchestration/");
  console.log("done — run: bun install && bun run check");
}

main();
