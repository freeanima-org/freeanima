import { describe, expect, it } from "bun:test";
import { hostnameFromUrl, markdownToPlainText, type SpeechPlaceholders } from "./plain-text.ts";

const ph: SpeechPlaceholders = {
  codeBlock: "此处为代码块",
  table: "此处为表格",
  link: (label) => `链接：${label}`,
  image: "图片省略",
};

describe("hostnameFromUrl", () => {
  it("提取域名并去掉 www 与 path", () => {
    expect(hostnameFromUrl("https://www.github.com/org/repo?x=1")).toBe("github.com");
  });
});

describe("markdownToPlainText", () => {
  it("去除标题与粗体", () => {
    expect(markdownToPlainText("## Hello\n\n**world**", ph)).toBe("Hello\n\nworld");
  });

  it("闭合代码块占位，行内代码仍可读", () => {
    expect(markdownToPlainText("use `foo()` in:\n\n```ts\nconst x = 1;\n```", ph)).toBe(
      "use foo() in:\n\n此处为代码块",
    );
  });

  it("未闭合代码块占位", () => {
    expect(markdownToPlainText("before\n```js\nconst x = 1;", ph)).toBe("before\n此处为代码块");
  });

  it("表格整块占位", () => {
    const md = "intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter";
    expect(markdownToPlainText(md, ph)).toBe("intro\n\n此处为表格\n\nafter");
  });

  it("链接保留文字并加前缀", () => {
    expect(markdownToPlainText("see [docs](https://example.com)", ph)).toBe("see 链接：docs");
  });

  it("无文字链接读域名", () => {
    expect(markdownToPlainText("see [](https://www.example.com/path)", ph)).toBe(
      "see 链接：example.com",
    );
  });

  it("裸 URL 只读域名", () => {
    expect(markdownToPlainText("visit https://github.com/org/repo?x=1 please", ph)).toBe(
      "visit 链接：github.com please",
    );
  });

  it("图片占位不读 alt", () => {
    expect(markdownToPlainText("pic ![alt text](https://cdn.example.com/a.png) end", ph)).toBe(
      "pic 图片省略 end",
    );
  });

  it("混排不丢前后文", () => {
    const md =
      "Hello\n\n```ts\ncode\n```\n\nsee [docs](https://example.com) and https://github.com/x\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nBye";
    expect(markdownToPlainText(md, ph)).toBe(
      "Hello\n\n此处为代码块\n\nsee 链接：docs and 链接：github.com\n\n此处为表格\n\nBye",
    );
  });

  it("列表项去掉标记", () => {
    expect(markdownToPlainText("- one\n- two\n1. three", ph)).toBe("one\ntwo\nthree");
  });
});
