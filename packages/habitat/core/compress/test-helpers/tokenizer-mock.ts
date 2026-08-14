import { afterEach, beforeEach } from "bun:test";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/habitat/core/tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/habitat/core/tokenizer/testing";

/** Unit tests: mock fallback tokenizer (~3.5 chars/token) without Habitat download. */
export function installTokenizerMockForTests(): void {
  beforeEach(async () => {
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text) => {
      const len = text.trim().length;
      if (!len) return [];
      const n = Math.max(1, Math.ceil(len / 3.5));
      return Array.from({ length: n }, (_, i) => i + 1);
    });
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("test");
  });
  afterEach(() => {
    resetTokenizerForTest();
  });
}
