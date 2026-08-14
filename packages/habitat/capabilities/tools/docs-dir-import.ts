/**
 * Standalone docs 嵌入：调用点 `dir:` 声明依赖整个 docs 树，
 * 由 `bun-plugin-dir-import` 展开为逐文件 `type: "file"`。
 *
 * 源码运行需 bunfig preload；仅 standalone-boot（runtimeMeta 非 null）时 dynamic import 并注册。
 */
import docsFiles from "dir:../../../../docs";

import type { EmbeddedDocsFile } from "./docs-embedded.ts";

function isStandaloneDocsRel(rel: string): boolean {
  if (!rel.endsWith(".md")) return false;
  if (rel.startsWith(".generated/") || rel.includes("/.generated/")) return false;
  return true;
}

/** 从 dir: map 得到现网契约：相对 docs/ 的 .md（跳过 .generated） */
export function listEmbeddedDocsFromDir(): EmbeddedDocsFile[] {
  return Object.entries(docsFiles)
    .filter(([rel]) => isStandaloneDocsRel(rel))
    .map(([rel, path]) => ({ rel, path }))
    .toSorted((a, b) => a.rel.localeCompare(b.rel));
}
