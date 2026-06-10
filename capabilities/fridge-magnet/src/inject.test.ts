import { describe, expect, it } from "bun:test";
import {
  formatFridgeMagnets,
  injectFridgeMagnets,
  stripFridgeMagnets,
  injectIntoMessages,
  stripAllFromMessages,
} from "./inject.ts";
import type { FridgeMagnet } from "./types.ts";

const sampleMagnets: FridgeMagnet[] = [
  { key: "user_mood", value: "晴朗" },
  { key: "task", value: "写测试" },
];

describe("formatFridgeMagnets", () => {
  it("格式化为 fridge 代码块", () => {
    expect(formatFridgeMagnets(sampleMagnets)).toBe(
      "```fridge\nuser_mood: 晴朗\ntask: 写测试\n```\n",
    );
  });

  it("空列表生成空代码块", () => {
    expect(formatFridgeMagnets([])).toBe("```fridge\n\n```\n");
  });
});

describe("injectFridgeMagnets", () => {
  it("在内容前注入冰箱贴块", () => {
    const result = injectFridgeMagnets("你好", sampleMagnets);
    expect(result).toBe("```fridge\nuser_mood: 晴朗\ntask: 写测试\n```\n你好");
  });
});

describe("stripFridgeMagnets", () => {
  it("剪除开头的冰箱贴块", () => {
    const content = "```fridge\nuser_mood: 晴朗\n```\n你好";
    expect(stripFridgeMagnets(content)).toBe("你好");
  });

  it("无冰箱贴块时原样返回", () => {
    expect(stripFridgeMagnets("纯文本")).toBe("纯文本");
  });

  it("幂等：重复剪除结果不变", () => {
    const once = stripFridgeMagnets("```fridge\na: 1\n```\n内容");
    expect(stripFridgeMagnets(once)).toBe(once);
  });
});

describe("injectIntoMessages", () => {
  it("注入到最后一条 user 消息", () => {
    const messages = [
      { role: "user", content: "第一条" },
      { role: "assistant", content: "回复" },
      { role: "user", content: "第二条" },
    ];
    injectIntoMessages(messages, [{ key: "note", value: "便签" }]);
    expect(messages[0]!.content).toBe("第一条");
    expect(messages[2]!.content).toBe("```fridge\nnote: 便签\n```\n第二条");
  });

  it("无 user 消息时不修改", () => {
    const messages = [{ role: "assistant", content: "仅助手" }];
    injectIntoMessages(messages, sampleMagnets);
    expect(messages[0]!.content).toBe("仅助手");
  });
});

describe("stripAllFromMessages", () => {
  it("剪除所有 user 消息中的冰箱贴块", () => {
    const messages = [
      { role: "user", content: "```fridge\na: 1\n```\n第一条" },
      { role: "assistant", content: "```fridge\nb: 2\n```\n回复" },
      { role: "user", content: "```fridge\nc: 3\n```\n第二条" },
    ];
    stripAllFromMessages(messages);
    expect(messages[0]!.content).toBe("第一条");
    expect(messages[1]!.content).toBe("```fridge\nb: 2\n```\n回复");
    expect(messages[2]!.content).toBe("第二条");
  });

  it("content 为 null 时跳过", () => {
    const messages = [{ role: "user", content: null }];
    stripAllFromMessages(messages);
    expect(messages[0]!.content).toBeNull();
  });
});
