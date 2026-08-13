/**
 * Standalone 嵌入清单 + 运行时元数据。
 * 源码运行时 embeds 为空、runtimeMeta 为 null；
 * `build:cli:executable` 经 Bun 插件替换为本文件并注入 type: "file" 与 meta 常量。
 *
 * migrations / docs 不走本清单：见 `migrations-dir-import` / `docs-dir-import`（`dir:`）。
 */
import type { ComponentBuildMeta } from "@freeanima/host/core/config/build-meta.parse";

export type StandaloneEmbedFile = {
  kind: "web";
  /** 相对 web dist 根 */
  rel: string;
  /** `with { type: "file" }` 解析后的路径（编译进二进制后可 fs 读取） */
  path: string;
};

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

export const standaloneEmbeds: StandaloneEmbedFile[] = [];

/** 编译期注入；源码为 null */
export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject | null = null;
