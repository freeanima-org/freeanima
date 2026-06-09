import type { EmbedTextFn } from "./types.ts";

let embedTextFn: EmbedTextFn | null = null;

export function registerEmbedTextFn(fn: EmbedTextFn | null): void {
  embedTextFn = fn;
}

export function getEmbedTextFn(): EmbedTextFn | null {
  return embedTextFn;
}

/** 测试 teardown */
export function resetEmbedTextFnForTest(): void {
  embedTextFn = null;
}
