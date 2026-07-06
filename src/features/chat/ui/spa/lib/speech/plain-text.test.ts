import { describe, expect, it } from "bun:test";
import { markdownToPlainText } from "./plain-text.ts";

describe("markdownToPlainText", () => {
  it("去除标题与粗体", () => {
    expect(markdownToPlainText("## Hello\n\n**world**")).toBe("Hello\n\nworld");
  });

  it("代码块与行内代码转为可读文本", () => {
    expect(markdownToPlainText("use `foo()` in:\n\n```ts\nconst x = 1;\n```")).toBe(
      "use foo() in:",
    );
  });

  it("链接保留可见文字", () => {
    expect(markdownToPlainText("see [docs](https://example.com)")).toBe("see docs");
  });

  it("列表项去掉标记", () => {
    expect(markdownToPlainText("- one\n- two\n1. three")).toBe("one\ntwo\nthree");
  });
});
