import { describe, expect, it } from "bun:test";
import {
  buildTextSearchSnippet,
  extractSearchTerms,
  formatSessionMessageSearchHit,
  stripHeadlineTags,
} from "./search-snippet.ts";

describe("search-snippet", () => {
  it("extractSearchTerms strips operators and quotes", () => {
    expect(extractSearchTerms("偏好 OR 简洁")).toEqual(["偏好", "简洁"]);
    expect(extractSearchTerms('"逸灵风" compression')).toEqual(["逸灵风", "compression"]);
  });

  it("buildTextSearchSnippet extracts window around match", () => {
    const content =
      "前面很长的一段无关文字讨论别的主题，中间 compression 算法很重要，后面还有更多无关内容。";
    const snippet = buildTextSearchSnippet("compression", content, { contextChars: 10 });
    expect(snippet).toContain("compression");
    expect(snippet.length).toBeLessThan(content.length);
  });

  it("formatSessionMessageSearchHit omits content", () => {
    const hit = formatSessionMessageSearchHit("hello", {
      session_id: "s1",
      message_id: "m1",
      role: "user",
      timestamp: "2026-01-01",
      content: "prefix hello world suffix",
      rank: 0.5,
    });
    expect(hit.snippet).toContain("hello");
    expect("content" in hit).toBe(false);
  });

  it("stripHeadlineTags removes b tags", () => {
    expect(stripHeadlineTags("…<b>compression</b>…")).toBe("…compression…");
  });
});
