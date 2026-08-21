#!/usr/bin/env bun
/**
 * Detect cycles in workspace package production dependencies.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isRecord } from "@freeanima/shared/util";

const ROOT = join(import.meta.dir, "..");

const WORKSPACE_DIRS = ["packages", "site"];

type PkgGraph = Map<string, string[]>;

function readPkgNameDeps(pkgPath: string): { name: string; deps: string[] } | null {
  const raw: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const deps = isRecord(raw.dependencies)
    ? Object.keys(raw.dependencies).filter((d) => d.startsWith("@freeanima/"))
    : [];
  return { name: raw.name, deps };
}

function collectPackages(): PkgGraph {
  const graph: PkgGraph = new Map();

  for (const top of WORKSPACE_DIRS) {
    const base = join(ROOT, top);
    if (!existsSync(base)) continue;

    const entries =
      top === "site"
        ? [{ name: ".", isDirectory: () => true as const }]
        : readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());

    for (const ent of entries) {
      if (!("isDirectory" in ent) || !ent.isDirectory()) continue;
      const dir = ent.name === "." ? base : join(base, ent.name);
      const pkgPath = join(dir, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = readPkgNameDeps(pkgPath);
      if (!pkg) continue;
      graph.set(pkg.name, pkg.deps);
    }
  }

  // Root orchestrator
  const rootPkgPath = join(ROOT, "package.json");
  if (existsSync(rootPkgPath)) {
    const pkg = readPkgNameDeps(rootPkgPath);
    if (pkg) graph.set(pkg.name, pkg.deps);
  }

  return graph;
}

function findCycle(graph: PkgGraph): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const i = stack.indexOf(node);
      return [...stack.slice(i), node];
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      const c = dfs(next);
      if (c) return c;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.keys()) {
    const c = dfs(node);
    if (c) return c;
  }
  return null;
}

const graph = collectPackages();
const cycle = findCycle(graph);
if (cycle) {
  console.error("workspace dependency cycle:", cycle.join(" → "));
  process.exit(1);
}
console.log(`check-package-cycles: ok (${graph.size} packages)`);
