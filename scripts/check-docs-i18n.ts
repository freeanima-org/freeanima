#!/usr/bin/env bun
/**
 * Validates English docs in the Starlight collection for po4a-friendly markdown.
 * Replaces check-docs-frontmatter.ts (same title check + structure rules).
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checkMarkdownI18n, type MarkdownCheckIssue } from "./docs-i18n-check-lib.ts";
import { listCollectionDocFiles } from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");
const files = listCollectionDocFiles();

const issues: MarkdownCheckIssue[] = [];
for (const abs of files) {
  const rel = relative(root, abs);
  const content = readFileSync(abs, "utf8");
  issues.push(...checkMarkdownI18n(content, rel));
}

if (issues.length > 0) {
  for (const { file, line, message } of issues) {
    const where = line ? `${file}:${line}` : file;
    console.error(`check-docs-i18n: ${where}: ${message}`);
  }
  console.error(`\ncheck-docs-i18n: ${issues.length} issue(s) in ${files.length} file(s).`);
  process.exit(1);
}

console.log(`check-docs-i18n: ok (${files.length} files checked)`);
