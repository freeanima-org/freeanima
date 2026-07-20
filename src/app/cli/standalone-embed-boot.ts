import { registerEmbeddedMigrations } from "@freeanima/core/db";
import { registerStandaloneRuntimeMeta } from "@freeanima/core/config/standalone-runtime-meta";
import { registerEmbeddedDocs } from "@freeanima/capabilities/tools/docs-embedded";
import { registerEmbeddedWebDist } from "./web/web-dist-embedded.ts";
import { standaloneEmbeds, standaloneRuntimeMeta } from "./standalone-embeds.ts";

/** 在 cli 入口最早 side-effect：把编译期嵌入注册到 globalThis */
export function bootStandaloneEmbeds(): void {
  if (standaloneRuntimeMeta != null) {
    registerStandaloneRuntimeMeta(standaloneRuntimeMeta);
  }

  if (standaloneEmbeds.length === 0) return;

  const migrations = standaloneEmbeds
    .filter((e) => e.kind === "migration")
    .map((e) => ({ name: e.rel, path: e.path }));
  const web = standaloneEmbeds
    .filter((e) => e.kind === "web")
    .map((e) => ({ rel: e.rel, path: e.path }));
  const docs = standaloneEmbeds
    .filter((e) => e.kind === "docs")
    .map((e) => ({ rel: e.rel, path: e.path }));

  if (migrations.length > 0) registerEmbeddedMigrations(migrations);
  if (web.length > 0) registerEmbeddedWebDist(web);
  if (docs.length > 0) registerEmbeddedDocs(docs);
}

/** 模块加载即注册，保证先于 ANIMA_VERSION / SERVICE_BUILD_META 求值 */
bootStandaloneEmbeds();
