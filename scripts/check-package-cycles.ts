#!/usr/bin/env bun
/**
 * Detect cycles in workspace package production dependencies.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const WORKSPACE_DIRS = [
  "kernel",
  "engine",
  "life",
  "service",
  "capabilities",
  "connectors",
  "cli",
  "tests",
];

type PkgGraph = Map<string, string[]>;

function collectPackages(): PkgGraph {
  const graph: PkgGraph = new Map();

  for (const top of WORKSPACE_DIRS) {
    const base = join(ROOT, top);
    if (!existsSync(base)) continue;

    const entries =
      top === "cli" || top === "tests"
        ? [{ name: ".", isDirectory: () => true }]
        : readdirSync(base, { withFileTypes: true });

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgDir = top === "cli" || top === "tests" ? base : join(base, ent.name);
      const pjPath = join(pkgDir, "package.json");
      if (!existsSync(pjPath)) continue;

      const manifest = JSON.parse(readFileSync(pjPath, "utf-8")) as {
        name?: string;
        dependencies?: Record<string, string>;
      };
      if (!manifest.name) continue;

      const deps = manifest.dependencies ?? {};
      const workspaceDeps = Object.entries(deps)
        .filter(([name, spec]) => name.startsWith("@freeanima/") && spec.includes("workspace"))
        .map(([name]) => name);

      graph.set(manifest.name, workspaceDeps);
      if (top === "cli" || top === "tests") break;
    }
  }

  return graph;
}

function stronglyConnectedComponents(graph: PkgGraph): string[][] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let id = 0;

  function strongconnect(v: string): void {
    index.set(v, id);
    lowlink.set(v, id);
    id += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1) sccs.push(scc.toSorted());
    }
  }

  for (const name of graph.keys()) {
    if (!index.has(name)) strongconnect(name);
  }

  return sccs;
}

const graph = collectPackages();
const cycles = stronglyConnectedComponents(graph);

if (cycles.length === 0) {
  console.log("package-cycles: OK");
  process.exit(0);
}

console.error(`package-cycles: ${cycles.length} cycle(s)`);
for (const scc of cycles) {
  console.error(`  ${scc.join(" ↔ ")}`);
}
process.exit(1);
