/**
 * Standalone 嵌入清单。
 * 源码运行时为空；`build:cli:executable` 经 Bun 插件替换为本文件并注入 `with { type: "file" }`。
 */
export type StandaloneEmbedFile = {
  kind: "migration" | "web";
  /** migration：drizzle 目录名；web：相对 web dist 根的路径 */
  rel: string;
  /** `with { type: "file" }` 解析后的路径（编译进二进制后可 fs 读取） */
  path: string;
};

export const standaloneEmbeds: StandaloneEmbedFile[] = [];
