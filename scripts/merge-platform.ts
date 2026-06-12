#!/usr/bin/env bun
/**
 * Phase 5: merge service/* + connectors/* into @freeanima/platform.
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
  ["@freeanima/platform/ports/", "@freeanima/platform/ports/"],
  ["@freeanima/platform/ports", "@freeanima/platform/ports"],
  ["@freeanima/platform/config", "@freeanima/platform/config"],
  ["@freeanima/platform/logging", "@freeanima/platform/logging"],
  ["@freeanima/platform/commands", "@freeanima/platform/commands"],
  ["@freeanima/platform/bootstrap", "@freeanima/platform/bootstrap"],
  ["@freeanima/platform", "@freeanima/platform"],
  [
    "@freeanima/platform/connectors/eventbus-redis",
    "@freeanima/platform/connectors/eventbus-redis",
  ],
  ["@freeanima/platform/connectors/db-pg", "@freeanima/platform/connectors/db-pg"],
  ["@freeanima/platform/connectors/gateway", "@freeanima/platform/connectors/gateway"],
  ["@freeanima/platform/connectors/webui", "@freeanima/platform/connectors/webui"],
  ["@freeanima/platform/connectors/cron", "@freeanima/platform/connectors/cron"],
  ["@freeanima/platform/connectors/email", "@freeanima/platform/connectors/email"],
  ["@freeanima/platform/connectors/redis", "@freeanima/platform/connectors/redis"],
];

const MOVES: [string, string][] = [
  ["service/service/src", "platform/src"],
  ["service/api/src", "platform/ports"],
  ["service/config/src", "platform/config"],
  ["service/logging/src", "platform/logging"],
  ["service/commands/src", "platform/commands"],
  ["service/bootstrap/src", "platform/bootstrap"],
  ["connectors/db-pg/src", "platform/connectors/db-pg"],
  ["connectors/gateway/src", "platform/connectors/gateway"],
  ["connectors/webui/src", "platform/connectors/webui"],
  ["connectors/cron/src", "platform/connectors/cron"],
  ["connectors/email/src", "platform/connectors/email"],
  ["connectors/redis/src", "platform/connectors/redis"],
  ["connectors/eventbus-redis/src", "platform/connectors/eventbus-redis"],
];

const CONNECTOR_ASSETS: [string, string][] = [
  ["connectors/webui/app", "platform/connectors/webui/app"],
  ["connectors/webui/public", "platform/connectors/webui/public"],
  ["connectors/webui/build.ts", "platform/connectors/webui/build.ts"],
  ["connectors/webui/dev.ts", "platform/connectors/webui/dev.ts"],
  ["connectors/webui/package.json", "platform/connectors/webui/package.json.bak"],
];

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyDir(src, dst);
    else cpSync(src, dst);
  }
}

function replace(content: string): string {
  let out = content;
  for (const [a, b] of IMPORT_REPLACEMENTS) out = out.split(a).join(b);
  return out;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "dist" || n === "coverage") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|md|mdc|toml|yaml|yml|sh)$/.test(n)) out.push(p);
  }
}

function collectDeps(): Record<string, string> {
  const deps: Record<string, string> = {};
  const dirs = ["service", "connectors"];
  for (const top of dirs) {
    const base = join(ROOT, top);
    if (!existsSync(base)) continue;
    for (const ent of readdirSync(base, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const pj = join(base, ent.name, "package.json");
      if (!existsSync(pj)) continue;
      const j = JSON.parse(readFileSync(pj, "utf-8")) as { dependencies?: Record<string, string> };
      for (const [k, v] of Object.entries(j.dependencies ?? {})) {
        if (k.startsWith("@freeanima/platform") || k.startsWith("@freeanima/connectors")) continue;
        deps[k] = v;
      }
    }
  }
  deps["@freeanima/core"] = "workspace:*";
  deps["@freeanima/runtime"] = "workspace:*";
  deps["@freeanima/kernel"] = "workspace:*";
  return Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}

function main(): void {
  rmSync(join(ROOT, "platform"), { recursive: true, force: true });
  mkdirSync(join(ROOT, "platform"), { recursive: true });

  for (const [from, to] of MOVES) {
    copyDir(join(ROOT, from), join(ROOT, to));
  }
  for (const [from, to] of CONNECTOR_ASSETS) {
    const src = join(ROOT, from);
    if (!existsSync(src)) continue;
    if (statSync(src).isDirectory()) copyDir(src, join(ROOT, to));
    else {
      mkdirSync(join(ROOT, to, ".."), { recursive: true });
      cpSync(src, join(ROOT, to));
    }
  }

  writeFileSync(
    join(ROOT, "platform/package.json"),
    JSON.stringify(
      {
        name: "@freeanima/platform",
        type: "module",
        exports: {
          ".": "./src/index.ts",
          "./alive": "./src/alive.ts",
          "./bind-hosts": "./src/bind-hosts.ts",
          "./runtime": "./src/runtime/index.ts",
          "./runtime/*": "./src/runtime/*.ts",
          "./schemas/*": "./src/schemas/*.ts",
          "./ports": "./ports/index.ts",
          "./ports/*": "./ports/*.ts",
          "./config": "./config/index.ts",
          "./config/*": "./config/*.ts",
          "./logging": "./logging/index.ts",
          "./logging/*": "./logging/*.ts",
          "./commands": "./commands/index.ts",
          "./bootstrap": "./bootstrap/index.ts",
          "./connectors/db-pg": "./connectors/db-pg/index.ts",
          "./connectors/gateway": "./connectors/gateway/index.ts",
          "./connectors/webui": "./connectors/webui/index.ts",
          "./connectors/webui/*": "./connectors/webui/*.ts",
          "./connectors/cron": "./connectors/cron/index.ts",
          "./connectors/cron/*": "./connectors/cron/*.ts",
          "./connectors/email": "./connectors/email/index.ts",
          "./connectors/redis": "./connectors/redis/index.ts",
          "./connectors/eventbus-redis": "./connectors/eventbus-redis/index.ts",
        },
        dependencies: collectDeps(),
        devDependencies: {
          "@types/bun": "catalog:",
          "@types/node": "catalog:",
          elysia: "^1.4.22",
          react: "^19.2.4",
          "react-dom": "^19.2.4",
        },
      },
      null,
      2,
    ) + "\n",
  );

  // platform/src/index.ts from service
  writeFileSync(
    join(ROOT, "platform/ports/index.ts"),
    readFileSync(join(ROOT, "platform/ports/index.ts"), "utf-8"),
  );

  const files: string[] = [];
  walk(ROOT, files);
  let n = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (rel.startsWith("service/") || rel.startsWith("connectors/")) continue;
    if (rel.startsWith("platform/connectors/webui/package.json.bak")) continue;
    const orig = readFileSync(f, "utf-8");
    const next = replace(orig);
    if (next !== orig) {
      writeFileSync(f, next);
      n++;
    }
  }

  walk(join(ROOT, "platform"), files);
  for (const f of files) {
    const orig = readFileSync(f, "utf-8");
    const next = replace(orig);
    if (next !== orig) writeFileSync(f, next);
  }

  rmSync(join(ROOT, "service"), { recursive: true, force: true });
  rmSync(join(ROOT, "connectors"), { recursive: true, force: true });

  const rootPj = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
    workspaces: { packages: string[] };
  };
  rootPj.workspaces.packages = rootPj.workspaces.packages
    .filter((p: string) => p !== "service/*" && p !== "connectors/*")
    .concat(["platform"]);
  writeFileSync(join(ROOT, "package.json"), JSON.stringify(rootPj, null, 2) + "\n");

  console.log(`platform merge: updated ${n} files; removed service/ connectors/`);
}

main();
