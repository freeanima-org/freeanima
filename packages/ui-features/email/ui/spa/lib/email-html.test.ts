import { describe, expect, test } from "bun:test";

import { buildEmailHtmlSrcDoc, looksLikeHtmlBody } from "./email-html.ts";

describe("looksLikeHtmlBody", () => {
  test("detects common email html wrappers", () => {
    expect(looksLikeHtmlBody('<div style="border:1px solid #C3C8CC"><p>hi</p></div>')).toBe(true);
    expect(looksLikeHtmlBody("plain text only")).toBe(false);
  });
});

describe("buildEmailHtmlSrcDoc", () => {
  test("wraps fragment with charset and csp", () => {
    const doc = buildEmailHtmlSrcDoc("<p>hi</p>");
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("background:#fff");
    expect(doc).toContain("<p>hi</p>");
    expect(doc).toContain("img-src https:");
  });

  test("injects csp into full documents", () => {
    const doc = buildEmailHtmlSrcDoc("<html><head></head><body><p>x</p></body></html>");
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("<p>x</p>");
  });
});
