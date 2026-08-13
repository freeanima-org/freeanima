/**
 * Standalone Web dist 嵌入：调用点 `dir:` 声明依赖整个 web/dist 树，
 * 由 `scripts/dir-import-plugin.ts` 展开为逐文件 `type: "file"`。
 *
 * 源码运行需 bunfig preload；目录缺失时为空 map。
 * 仅 standalone-boot（runtimeMeta 非 null）时 dynamic import；非空才注册。
 */
import webDistFiles from "dir:../../app/web/dist";

import type { EmbeddedWebDistFile } from "./web-dist-embedded.ts";

function isStandaloneWebRel(rel: string): boolean {
  if (rel === ".ok" || rel.endsWith("/.ok")) return false;
  return true;
}

/** 从 dir: map 得到现网契约：相对 web dist 根的路径 */
export function listEmbeddedWebDistFromDir(): EmbeddedWebDistFile[] {
  return Object.entries(webDistFiles)
    .filter(([rel]) => isStandaloneWebRel(rel))
    .map(([rel, path]) => ({ rel, path }))
    .toSorted((a, b) => a.rel.localeCompare(b.rel));
}
