import type { ComponentBuildMeta } from "./build-meta.ts";

/** esbuild / Vite define 注入值（替换为 JSON 对象字面量） */
export function nativeBuildMetaDefine(meta: ComponentBuildMeta): Record<string, string> {
  return { __NATIVE_BUILD_META__: JSON.stringify(meta) };
}
