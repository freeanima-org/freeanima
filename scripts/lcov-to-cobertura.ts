import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { LcovCobertura } from "@splicemood/lcov-to-cobertura";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const lcovPath = join(repoRoot, "coverage", "lcov.info");
const outPath = join(repoRoot, "coverage", "cobertura.xml");

if (!existsSync(lcovPath)) {
  console.error(`[coverage:cobertura] missing ${lcovPath}; run tests with --coverage first`);
  process.exit(1);
}

const lcov = readFileSync(lcovPath, "utf-8");
const xml = new LcovCobertura(lcov).convert();
writeFileSync(outPath, xml);
console.log(`[coverage:cobertura] wrote ${outPath}`);
