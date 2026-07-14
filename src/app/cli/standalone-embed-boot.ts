import { registerEmbeddedMigrations } from "@freeanima/core/db";
import { registerEmbeddedWebDist } from "./web/web-dist-embedded.ts";
import { standaloneEmbeds } from "./standalone-embeds.ts";

/** 在 cli 入口最早 side-effect：把编译期嵌入注册到 globalThis */
export function bootStandaloneEmbeds(): void {
  if (standaloneEmbeds.length === 0) return;

  const migrations = standaloneEmbeds
    .filter((e) => e.kind === "migration")
    .map((e) => ({ name: e.rel, path: e.path }));
  const web = standaloneEmbeds
    .filter((e) => e.kind === "web")
    .map((e) => ({ rel: e.rel, path: e.path }));

  if (migrations.length > 0) registerEmbeddedMigrations(migrations);
  if (web.length > 0) registerEmbeddedWebDist(web);
}
