import { registerEmbeddedMigrations } from "@freeanima/host/core/db";
import { listEmbeddedMigrationsFromDir } from "@freeanima/host/core/db/migrations-dir-import";
import { registerStandaloneRuntimeMeta } from "@freeanima/host/core/config/standalone-runtime-meta";
import { registerEmbeddedDocs } from "@freeanima/host/capabilities/tools/docs-embedded";
import { registerEmbeddedWebDist } from "./web/web-dist-embedded.ts";
import { standaloneEmbeds, standaloneRuntimeMeta } from "./standalone-embeds.ts";

/** 在 cli 入口最早 side-effect：把编译期嵌入注册到 globalThis */
export function bootStandaloneEmbeds(): void {
  if (standaloneRuntimeMeta != null) {
    registerStandaloneRuntimeMeta(standaloneRuntimeMeta);
    const migrations = listEmbeddedMigrationsFromDir();
    if (migrations.length === 0) {
      throw new Error(
        "standalone: dir:../migrations 未解析到任何 migration.sql（检查 dir-import 插件是否接入 Bun.build）",
      );
    }
    registerEmbeddedMigrations(migrations);
  }

  if (standaloneEmbeds.length === 0) return;

  const web = standaloneEmbeds
    .filter((e) => e.kind === "web")
    .map((e) => ({ rel: e.rel, path: e.path }));
  const docs = standaloneEmbeds
    .filter((e) => e.kind === "docs")
    .map((e) => ({ rel: e.rel, path: e.path }));

  if (web.length > 0) registerEmbeddedWebDist(web);
  if (docs.length > 0) registerEmbeddedDocs(docs);
}

/** 模块加载即注册，保证先于 ANIMA_VERSION / SERVICE_BUILD_META 求值 */
bootStandaloneEmbeds();
