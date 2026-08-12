import { describe, expect, it } from "bun:test";

import { renderMarkdownHtml } from "./markdown.ts";

describe("renderMarkdownHtml", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdownHtml("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("rewrites anima URI markers as #id chips", () => {
    const html = renderMarkdownHtml("see [[anima:42]]");
    expect(html).toContain('data-anima-uri="anima:42"');
    expect(html).toContain('href="anima:42"');
    expect(html).toContain('class="anima-uri-chip"');
    expect(html).toContain(">#42</a>");
    expect(html).not.toContain("[[anima:42]]");
    expect(html).not.toContain("link-hover");
  });

  it("appends label snippet when provided", () => {
    const html = renderMarkdownHtml("see [[anima:42]]", new Map([[42, "上海居住"]]));
    expect(html).toContain(">#42 上海居住</a>");
  });

  it("escapes label HTML", () => {
    const html = renderMarkdownHtml("x [[anima:1]]", new Map([[1, '<img onerror="x">']]));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
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
