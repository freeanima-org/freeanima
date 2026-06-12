#!/usr/bin/env bun
/**
 * Validates that every doc file included in the Astro/Starlight content
 * collection has a frontmatter `title` field.
 *
 * Mirrors the glob patterns from site/src/content.config.ts so failures are
 * caught at pre-commit / CI rather than at site build time.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const docsRoot = join(root, "docs");

/** Sub-directories of docsRoot that are included in the Astro collection. */
const INCLUDED_DIRS = ["guide", "concepts", "features", "tools"];

/** Returns true if the file content has a `title:` key in its YAML frontmatter. */
function hasFrontmatterTitle(content: string): boolean {
  if (!content.startsWith("---")) return false;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return false;
  const fm = content.slice(3, end);
  return /^title\s*:/m.test(fm);
}

function collectDocFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).toSorted()) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...collectDocFiles(path));
    } else if (/\.mdx?$/i.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const files: string[] = [];

// README.md at the docs root
const readme = join(docsRoot, "README.md");
if (existsSync(readme)) files.push(readme);

// Subdirectories included in the content collection
for (const dir of INCLUDED_DIRS) {
  files.push(...collectDocFiles(join(docsRoot, dir)));
}

const missing = files.filter((f) => !hasFrontmatterTitle(readFileSync(f, "utf8")));

if (missing.length > 0) {
  for (const f of missing) {
    console.error(`check-docs-frontmatter: missing title in ${relative(root, f)}`);
  }
  console.error(
    `\ncheck-docs-frontmatter: ${missing.length} file(s) are missing a frontmatter 'title' field.`,
  );
  process.exit(1);
}

console.log(`check-docs-frontmatter: ok (${files.length} files checked)`);
