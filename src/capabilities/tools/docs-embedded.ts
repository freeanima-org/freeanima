/** Standalone 编译期嵌入的 FreeAnima docs（相对 docs/ 根的路径）。 */

export type EmbeddedDocsFile = {
  /** 相对 docs/ 根，如 `concepts/architecture.md` */
  rel: string;
  /** `with { type: "file" }` 解析后的路径 */
  path: string;
};

const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_DOCS__";

type EmbeddedDocsGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: EmbeddedDocsFile[];
};

/** 由 standalone-embed-boot（编译期 type:file 嵌入）注入 */
export function registerEmbeddedDocs(files: EmbeddedDocsFile[]): void {
  (globalThis as EmbeddedDocsGlobal)[GLOBAL_KEY] = files;
}

export function getRegisteredEmbeddedDocs(): EmbeddedDocsFile[] | null {
  const files = (globalThis as EmbeddedDocsGlobal)[GLOBAL_KEY];
  return files && files.length > 0 ? files : null;
}

/** 测试用：清空嵌入清单 */
export function resetEmbeddedDocsForTest(): void {
  delete (globalThis as EmbeddedDocsGlobal)[GLOBAL_KEY];
}
