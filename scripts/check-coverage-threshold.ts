import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const lcovPath = join(repoRoot, "coverage", "lcov.info");
const baselinePath = join(repoRoot, "scripts", "coverage-baseline.json");

type Baseline = {
  lines: number;
  functions: number;
  slack: number;
};

function loadBaseline(): Baseline {
  if (!existsSync(baselinePath)) {
    return { lines: 0, functions: 0, slack: 0 };
  }
  const raw = JSON.parse(readFileSync(baselinePath, "utf-8")) as Baseline;
  return raw;
}

function parseLcovRates(lcov: string): { lines: number; functions: number } {
  let totalLines = 0;
  let hitLines = 0;
  let totalFuncs = 0;
  let hitFuncs = 0;

  for (const line of lcov.split("\n")) {
    if (line.startsWith("LF:")) totalLines += Number(line.slice(3));
    else if (line.startsWith("LH:")) hitLines += Number(line.slice(3));
    else if (line.startsWith("FNF:")) totalFuncs += Number(line.slice(4));
    else if (line.startsWith("FNH:")) hitFuncs += Number(line.slice(4));
  }

  return {
    lines: totalLines === 0 ? 1 : hitLines / totalLines,
    functions: totalFuncs === 0 ? 1 : hitFuncs / totalFuncs,
  };
}

if (!existsSync(lcovPath)) {
  console.error(`[coverage:check-threshold] 缺少 ${lcovPath}`);
  process.exit(1);
}

const baseline = loadBaseline();
const minLines = Math.max(0, baseline.lines - baseline.slack);
const minFunctions = Math.max(0, baseline.functions - baseline.slack);

const rates = parseLcovRates(readFileSync(lcovPath, "utf-8"));
const linesPct = (rates.lines * 100).toFixed(2);
const funcsPct = (rates.functions * 100).toFixed(2);
const minLinesPct = (minLines * 100).toFixed(2);
const minFuncsPct = (minFunctions * 100).toFixed(2);

console.log(
  `[coverage:check-threshold] lines=${linesPct}% functions=${funcsPct}% (要求 ≥ ${minLinesPct}% / ${minFuncsPct}%)`,
);

if (rates.lines < minLines || rates.functions < minFunctions) {
  process.exit(1);
}
