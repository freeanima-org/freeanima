/**
 * Standalone migrations 嵌入：调用点 `dir:` 声明依赖整个 migrations 树，
 * 由 `scripts/dir-import-plugin.ts` 展开为逐文件 `type: "file"`。
 *
 * 源码运行需 bunfig preload 注册该插件；仅在 standalone（注入了 runtimeMeta）时注册到 globalThis。
 */
import migrationFiles from "dir:../migrations";

import type { EmbeddedMigrationFile } from "./migrations-embedded.ts";

/** 从 dir: map 得到现网契约：`name` = drizzle 目录名，`path` = type:file 路径 */
export function listEmbeddedMigrationsFromDir(): EmbeddedMigrationFile[] {
  return Object.entries(migrationFiles)
    .filter(([rel]) => rel.endsWith("/migration.sql"))
    .map(([rel, path]) => ({
      name: rel.slice(0, -"/migration.sql".length),
      path,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
