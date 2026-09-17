import { standaloneRuntimeMeta } from "./standalone-meta.ts";

/** Standalone 安装版（编译注入了 runtimeMeta）；源码 / link:global 为 false */
export function isStandaloneCli(): boolean {
  return standaloneRuntimeMeta != null;
}
