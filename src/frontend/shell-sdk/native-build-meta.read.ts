import { parseComponentBuildMeta, type ComponentBuildMeta } from "./build-meta.ts";

/** 从 esbuild/Vite define 注入的 native build 元数据读取（浏览器安全） */
export function readNativeBuildMetaFromDefine(raw: unknown): ComponentBuildMeta | undefined {
  const parsed = parseComponentBuildMeta(raw);
  return parsed?.component === "native" ? parsed : undefined;
}
