import { existsSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

import type { StandaloneEmbedInput } from "./standalone-embed-plugin.ts";

/** 收集 docs 下全部 .md 供 standalone 嵌入（跳过 .generated） */
export function listDocsEmbeds(docsDir: string): StandaloneEmbedInput[] {
  if (!existsSync(docsDir)) {
    throw new Error(`docs/ 缺失（${docsDir}）`);
  }
  const files: StandaloneEmbedInput[] = [];
  for (const rel of new Glob("**/*.md").scanSync({ cwd: docsDir, onlyFiles: true })) {
    const normalized = rel.split("\\").join("/");
    if (normalized.startsWith(".generated/") || normalized.includes("/.generated/")) continue;
    files.push({
      kind: "docs",
      rel: normalized,
      absPath: join(docsDir, normalized),
    });
  }
  if (files.length === 0) {
    throw new Error(`docs/ 下无 Markdown: ${docsDir}`);
  }
  return files.toSorted((a, b) => a.rel.localeCompare(b.rel));
}
