import { describe, expect, it } from "bun:test";

import {
  CONVERSATION_MEMORY_FIELDS,
  ORGANIZE_MEMORY_FIELDS,
  RESIDENT_MEMORY_FIELDS,
  formatPromptAttrTimestamp,
  parseRenderedMemoryIds,
  renderConversationMessage,
  renderConversationMessageList,
  renderSemanticMemoryItem,
  renderSemanticMemoryList,
  toSemanticMemoryPromptItem,
} from "./semantic-memory-render.ts";

describe("renderSemanticMemoryItem", () => {
  it("整理字段：id + type/sources/observed/occurred，空值省略", () => {
    const xml = renderSemanticMemoryItem(
      {
        id: 18666,
        content: "肌肉酸痛的原因是乳酸",
        type: "world",
        sources: ["20260817_120043_9c27"],
        observed: new Date("2026-08-16T08:00:00.000Z"),
        occurred: "2026-08-15",
      },
      { fields: ORGANIZE_MEMORY_FIELDS },
    );
    expect(xml).toBe(
      '<memory id="18666" type="world" sources="20260817_120043_9c27" observed="2026-08-16T08:00:00" occurred="2026-08-15">肌肉酸痛的原因是乳酸</memory>',
    );
  });

  it("对话精简字段只有 id；pinned 仅 true 时写出", () => {
    expect(
      renderSemanticMemoryItem(
        { id: 4057, content: "Alice lives in Shanghai", pinned: false },
        { fields: CONVERSATION_MEMORY_FIELDS },
      ),
    ).toBe('<memory id="4057">Alice lives in Shanghai</memory>');
    expect(
      renderSemanticMemoryItem(
        { id: 42, content: "I like testing", pinned: true },
        { fields: RESIDENT_MEMORY_FIELDS },
      ),
    ).toBe('<memory id="42" pinned="true">I like testing</memory>');
  });

  it("属性引号转义；多行用开闭标签", () => {
    expect(
      renderSemanticMemoryItem({ id: 1, content: "a", type: 'x"y' }, { fields: ["type"] }),
    ).toBe('<memory id="1" type="x&quot;y">a</memory>');
    expect(renderSemanticMemoryItem({ id: 2, content: "line1\nline2" })).toBe(
      `<memory id="2">
line1
line2
</memory>`,
    );
  });

  it("空白正文跳过", () => {
    expect(renderSemanticMemoryItem({ id: 1, content: "  \n" })).toBe("");
  });
});

describe("renderSemanticMemoryList", () => {
  it("maxChars 整条丢弃", () => {
    const { text, includedIds } = renderSemanticMemoryList(
      [
        { id: 1, content: "short" },
        { id: 2, content: "this one is too long to fit" },
      ],
      { fields: CONVERSATION_MEMORY_FIELDS, maxChars: 40 },
    );
    expect(text).toContain('id="1"');
    expect(text).not.toContain('id="2"');
    expect(includedIds).toEqual([1]);
  });
});

describe("toSemanticMemoryPromptItem", () => {
  it("映射 row 与 recall hit", () => {
    expect(
      toSemanticMemoryPromptItem({
        id: 9,
        semantic_memory_id: 77,
        content: "x",
        type: "world",
        source_conversations: ["c1"],
        observed_at: "2026-08-16T08:00:00+08:00",
        occurred_at: "summer",
        pinned: true,
        reference_count: 3,
      }),
    ).toEqual({
      id: 77,
      content: "x",
      type: "world",
      sources: ["c1"],
      observed: "2026-08-16T08:00:00+08:00",
      occurred: "summer",
      pinned: true,
      refs: 3,
    });
  });
});

describe("renderConversationMessage", () => {
  it("role 必出，t 截到秒，缺则省略", () => {
    expect(
      renderConversationMessage({
        role: "user",
        content: "你好",
        t: "2026-08-18T18:22:00+08:00",
      }),
    ).toBe('<message role="user" t="2026-08-18T18:22:00">你好</message>');
    expect(renderConversationMessage({ role: "assistant", content: "好的" })).toBe(
      '<message role="assistant">好的</message>',
    );
  });

  it("列表拼接多条", () => {
    const text = renderConversationMessageList([
      { role: "user", content: "q", t: "2026-08-18T18:22:00" },
      { role: "assistant", content: "a", t: "2026-08-18T18:22:08" },
    ]);
    expect(text).toBe(
      '<message role="user" t="2026-08-18T18:22:00">q</message>\n<message role="assistant" t="2026-08-18T18:22:08">a</message>',
    );
  });
});

describe("parseRenderedMemoryIds / formatPromptAttrTimestamp", () => {
  it("解析 id 并去重", () => {
    expect(parseRenderedMemoryIds('<memory id="1">a</memory>\n<memory id="1">b</memory>')).toEqual([
      1,
    ]);
    expect(parseRenderedMemoryIds('<memory id="9" type="world">x</memory>')).toEqual([9]);
  });

  it("Date 用 UTC ISO 秒", () => {
    expect(formatPromptAttrTimestamp(new Date("2026-08-16T08:00:00.000Z"))).toBe(
      "2026-08-16T08:00:00",
    );
    expect(formatPromptAttrTimestamp("")).toBeUndefined();
  });
});
