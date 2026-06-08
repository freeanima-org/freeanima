import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const lcovPath = join(repoRoot, "coverage", "lcov.info");

/** 与 bunfig.toml coverageThreshold 一致；0 表示仅上报、不卡 CI */
const THRESHOLD = 0;

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

const rates = parseLcovRates(readFileSync(lcovPath, "utf-8"));
const linesPct = (rates.lines * 100).toFixed(2);
const funcsPct = (rates.functions * 100).toFixed(2);

console.log(
  `[coverage:check-threshold] lines=${linesPct}% functions=${funcsPct}% (要求 ≥ ${THRESHOLD * 100}%)`,
);

if (rates.lines < THRESHOLD || rates.functions < THRESHOLD) {
  process.exit(1);
}
