import type { EmbedTextFn, EmbedTextsFn } from "./types.ts";

let embedTextFn: EmbedTextFn | null = null;
let embedTextsFn: EmbedTextsFn | null = null;

export function registerEmbedTextFn(fn: EmbedTextFn | null): void {
  embedTextFn = fn;
}

export function getEmbedTextFn(): EmbedTextFn | null {
  return embedTextFn;
}

export function registerEmbedTextsFn(fn: EmbedTextsFn | null): void {
  embedTextsFn = fn;
}

export function getEmbedTextsFn(): EmbedTextsFn | null {
  return embedTextsFn;
}

/** 测试 teardown */
export function resetEmbedTextFnForTest(): void {
  embedTextFn = null;
}

export function resetEmbedTextsFnForTest(): void {
  embedTextsFn = null;
}
