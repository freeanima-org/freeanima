/**
 * Standalone 运行时元数据。
 * 源码：`null`；`just pack cli` 经 Bun.build `files` 虚拟覆盖注入 version / buildMeta。
 */
import type { ComponentBuildMeta } from "@freeanima/habitat/core/config/build-meta.parse";

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

/** 编译期由 pack `files` 覆盖；源码为 null */
export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject | null = null;
