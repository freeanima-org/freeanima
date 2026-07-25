import { standaloneEmbeds } from "./standalone-embeds.ts";

/** Standalone 安装版（编译嵌入非空）；源码 / link:global 为 false */
export function isStandaloneCli(): boolean {
  return standaloneEmbeds.length > 0;
}
