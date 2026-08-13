/**
 * Standalone 运行时元数据注入点。
 * 源码运行时 runtimeMeta 为 null；
 * `build:cli:executable` 经 Bun 插件替换并注入 version / buildMeta。
 *
 * migrations / docs / web dist 均走 `dir:` 调用点，不经本文件清单。
 */
import type { ComponentBuildMeta } from "@freeanima/host/core/config/build-meta.parse";

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

/** 编译期注入；源码为 null */
export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject | null = null;
