import { join } from "node:path";

import {
  createComponentBuildMeta,
  readBuildMetaFile,
  type ComponentBuildMeta,
} from "@freeanima/host/core/config/build-meta";
import { getCliInstallKind } from "@freeanima/host/core/config/cli-install";
import { getRepoRoot } from "@freeanima/host/core/config/repo-root";
import { getStandaloneRuntimeMeta } from "@freeanima/host/core/config/standalone-runtime-meta";

let cachedServiceBuildMeta: ComponentBuildMeta | null = null;

function bakedServiceBuildMetaPath(repoRoot: string): string {
  return join(repoRoot, "dist", "build-meta.json");
}

/** Habitat / CLI service 进程启动时 resolve 一次并缓存 */
export function resolveServiceBuildMeta(): ComponentBuildMeta {
  if (cachedServiceBuildMeta) return cachedServiceBuildMeta;

  const embedded = getStandaloneRuntimeMeta()?.buildMeta;
  if (embedded?.component === "service") {
    cachedServiceBuildMeta = embedded;
    return cachedServiceBuildMeta;
  }

  const repoRoot = getRepoRoot();
  const baked = readBuildMetaFile(bakedServiceBuildMetaPath(repoRoot));
  if (baked?.component === "service") {
    cachedServiceBuildMeta = baked;
    return cachedServiceBuildMeta;
  }

  const installKind = getCliInstallKind();
  const channel = installKind === "standalone" ? "release" : "dev";

  cachedServiceBuildMeta = createComponentBuildMeta({
    component: "service",
    channel,
    repoRoot,
    includeBuiltAt: false,
  });
  return cachedServiceBuildMeta;
}

export const SERVICE_BUILD_META: ComponentBuildMeta = resolveServiceBuildMeta();

/** 测试用：重置缓存 */
export function resetServiceBuildMetaForTests(): void {
  cachedServiceBuildMeta = null;
}
