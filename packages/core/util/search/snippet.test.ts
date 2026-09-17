import { describe, expect, it } from "bun:test";
import {
  buildTextSearchSnippet,
  extractSearchTerms,
  formatStoredMessageSearchHit,
} from "./snippet.ts";

describe("search-snippet", () => {
  it("extractSearchTerms strips operators and quotes", () => {
    expect(extractSearchTerms("preference OR concise")).toEqual(["preference", "concise"]);
    expect(extractSearchTerms('"FreeAnima" compression')).toEqual(["FreeAnima", "compression"]);
  });

  it("buildTextSearchSnippet extracts window around match", () => {
    const content =
      "A long irrelevant paragraph about other topics; compression algorithm matters in the middle; more irrelevant content follows.";
    const snippet = buildTextSearchSnippet("compression", content, { contextChars: 10 });
    expect(snippet).toContain("compression");
    expect(snippet.length).toBeLessThan(content.length);
  });

  it("formatStoredMessageSearchHit omits content", () => {
    const hit = formatStoredMessageSearchHit("hello", {
      conversation_id: "s1",
      message_id: "m1",
      role: "user",
      timestamp: "2026-01-01",
      content: "prefix hello world suffix",
      rank: 0.5,
    });
    expect(hit.snippet).toContain("hello");
    expect("content" in hit).toBe(false);
  });
});
