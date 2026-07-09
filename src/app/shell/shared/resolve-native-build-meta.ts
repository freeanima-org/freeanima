import {
  createComponentBuildMeta,
  type BuildChannel,
  type ComponentBuildMeta,
} from "../vite-config-imports.ts";

/** Node / 构建脚本：生成 native shell build meta */
export function resolveNativeBuildMeta(opts: {
  shell: "desktop" | "mobile";
  channel: BuildChannel;
  repoRoot: string;
  version?: string;
}): ComponentBuildMeta {
  return createComponentBuildMeta({
    component: "native",
    shell: opts.shell,
    channel: opts.channel,
    repoRoot: opts.repoRoot,
    ...(opts.version ? { version: opts.version } : {}),
    includeBuiltAt: opts.channel === "prod",
  });
}
