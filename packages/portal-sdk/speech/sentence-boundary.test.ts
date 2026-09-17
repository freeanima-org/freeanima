import { describe, expect, it } from "bun:test";
import { extractCompletedSentences, extractRemainder } from "./sentence-boundary.ts";

describe("extractCompletedSentences", () => {
  it("按 。！？ 与换行切分", () => {
    const { sentences, nextIndex } = extractCompletedSentences("你好。世界！吗？\n尾", 0);
    expect(sentences).toEqual(["你好。", "世界！", "吗？"]);
    expect(nextIndex).toBe("你好。世界！吗？\n".length);
    expect(extractRemainder("你好。世界！吗？\n尾", nextIndex)).toBe("尾");
  });

  it("无完整句时不前进游标", () => {
    const text = "还在生成中";
    const { sentences, nextIndex } = extractCompletedSentences(text, 0);
    expect(sentences).toEqual([]);
    expect(nextIndex).toBe(0);
  });

  it("从 fromIndex 继续消费", () => {
    const text = "第一句。第二句。";
    const first = extractCompletedSentences(text, 0);
    expect(first.sentences).toEqual(["第一句。", "第二句。"]);
    const more = text + "第三句。";
    const second = extractCompletedSentences(more, first.nextIndex);
    expect(second.sentences).toEqual(["第三句。"]);
  });

  it("跳过仅空白的片段", () => {
    const { sentences, nextIndex } = extractCompletedSentences("  。下一段！", 0);
    expect(sentences).toEqual(["下一段！"]);
    expect(nextIndex).toBe("  。下一段！".length);
  });

  it("英文句号不作为边界", () => {
    const { sentences, nextIndex } = extractCompletedSentences("Hello. World。", 0);
    expect(sentences).toEqual(["Hello. World。"]);
    expect(nextIndex).toBe("Hello. World。".length);
  });
});
