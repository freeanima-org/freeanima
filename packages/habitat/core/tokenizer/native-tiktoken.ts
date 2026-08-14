import { get_encoding, type Tiktoken } from "tiktoken";

export const NATIVE_TIKTOKEN_REPO = "__native__:tiktoken/cl100k_base";

const TIKTOKEN_MODEL_RE = /^(gpt-|chatgpt-|o1-|o3-|o4-)/i;

let cl100kEncoding: Tiktoken | null = null;

function getCl100kEncoding(): Tiktoken {
  if (!cl100kEncoding) {
    cl100kEncoding = get_encoding("cl100k_base");
  }
  return cl100kEncoding;
}

export function isTiktokenModel(model: string): boolean {
  return TIKTOKEN_MODEL_RE.test(model.trim());
}

export function tiktokenEncode(text: string): number[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return Array.from(getCl100kEncoding().encode(trimmed));
}

export function resetTiktokenForTest(): void {
  if (cl100kEncoding) {
    cl100kEncoding.free();
    cl100kEncoding = null;
  }
}
