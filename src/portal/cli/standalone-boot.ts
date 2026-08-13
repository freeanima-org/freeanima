/**
 * Standalone CLI 启动注册：有 runtimeMeta 时注册 meta，并经 `dir:` 注册
 * migrations / docs / web dist（动态 import，源码路径不展开目录树）。
 */
import { registerEmbeddedMigrations } from "@freeanima/host/core/db";
import { registerStandaloneRuntimeMeta } from "@freeanima/host/core/config/standalone-runtime-meta";
import { registerEmbeddedDocs } from "@freeanima/host/capabilities/tools/docs-embedded";
import { registerEmbeddedWebDist } from "./web/web-dist-embedded.ts";
import { standaloneRuntimeMeta } from "./standalone-meta.ts";

/** 须在导入会求值 ANIMA_VERSION / SERVICE_BUILD_META 的模块之前 await */
export async function bootStandalone(): Promise<void> {
  if (standaloneRuntimeMeta == null) return;

  registerStandaloneRuntimeMeta(standaloneRuntimeMeta);

  const { listEmbeddedMigrationsFromDir } =
    await import("@freeanima/host/core/db/migrations-dir-import");
  const migrations = listEmbeddedMigrationsFromDir();
  if (migrations.length === 0) {
    throw new Error(
      "standalone: dir:../migrations 未解析到任何 migration.sql（检查 dir-import 插件是否接入 Bun.build）",
    );
  }
  registerEmbeddedMigrations(migrations);

  const { listEmbeddedDocsFromDir } =
    await import("@freeanima/host/capabilities/tools/docs-dir-import");
  const docs = listEmbeddedDocsFromDir();
  if (docs.length === 0) {
    throw new Error(
      "standalone: dir:…/docs 未解析到任何 .md（检查 dir-import 插件是否接入 Bun.build）",
    );
  }
  registerEmbeddedDocs(docs);

  const { listEmbeddedWebDistFromDir } = await import("./web/web-dist-dir-import.ts");
  const web = listEmbeddedWebDistFromDir();
  if (web.length === 0) {
    throw new Error(
      "standalone: dir:…/web/dist 未解析到任何文件（请先 pack web，并确认 dir-import 插件已接入）",
    );
  }
  registerEmbeddedWebDist(web);
}
