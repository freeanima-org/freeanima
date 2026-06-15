#!/usr/bin/env bun
/**
 * Validates po4a-generated Chinese docs under docs/.generated/zh_CN/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { checkMarkdownI18n, type MarkdownCheckIssue } from "./docs-i18n-check-lib.ts";
import { generatedZhRoot } from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");

function collectGenerated(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).toSorted()) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...collectGenerated(path));
    } else if (/\.mdx?$/i.test(name)) {
      out.push(path);
    }
  }
  return out;
}

if (!existsSync(generatedZhRoot)) {
  console.error("check-generated-docs-i18n: missing docs/.generated/zh_CN/; run bun run i18n:po4a");
  process.exit(1);
}

const files = collectGenerated(generatedZhRoot);
const issues: MarkdownCheckIssue[] = [];

for (const abs of files) {
  const rel = relative(root, abs);
  const content = readFileSync(abs, "utf8");
  issues.push(...checkMarkdownI18n(content, rel));
}

if (issues.length > 0) {
  for (const { file, line, message } of issues) {
    const where = line ? `${file}:${line}` : file;
    console.error(`check-generated-docs-i18n: ${where}: ${message}`);
  }
  console.error(
    `\ncheck-generated-docs-i18n: ${issues.length} issue(s) in ${files.length} file(s).`,
  );
  process.exit(1);
}

console.log(`check-generated-docs-i18n: ok (${files.length} files checked)`);
