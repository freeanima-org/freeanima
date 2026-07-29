import { describe, expect, it } from "bun:test";

import { renderMarkdownHtml } from "./markdown.ts";

describe("renderMarkdownHtml", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdownHtml("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("rewrites anima URI markers", () => {
    const html = renderMarkdownHtml("see [[anima:42]]");
    expect(html).toContain('data-anima-uri="anima:42"');
    expect(html).toContain("[[anima:42]]");
  });

  it("strips script tags", () => {
    const html = renderMarkdownHtml("<script>alert(1)</script>hi");
    expect(html).not.toContain("<script");
    expect(html).toContain("hi");
  });

  it("returns empty for empty input", () => {
    expect(renderMarkdownHtml("")).toBe("");
  });
});
