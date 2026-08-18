import { describe, expect, it } from "bun:test";

import { SELF_LAYER_SYSTEM_FRAME } from "@freeanima/habitat/capabilities/self";
import { MEMORY_REFERENCE_CITATION_RULE } from "@freeanima/habitat/capabilities/memory/memory-reference";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import {
  AUTO_LLM_PROTOCOL_BODY,
  composeAutoLlmPrompt,
  formatCronAutoLlmTaskSpec,
} from "./auto-llm-prompt.ts";

describe("composeAutoLlmPrompt", () => {
  it("四层：system 含 protocol+task_spec；skills/data 分 user；无对话记忆策略", () => {
    const { systemPrompt, userMessages } = composeAutoLlmPrompt({
      kind: "cron",
      taskSpec: formatCronAutoLlmTaskSpec(),
      skillsText: "skill-alpha body",
      dataParts: [{ body: "job prompt here" }],
    });

    expect(systemPrompt).toContain(`<${PROMPT_XML_TAGS.autoLlmProtocol}>`);
    expect(systemPrompt).toContain(AUTO_LLM_PROTOCOL_BODY.slice(0, 20));
    expect(systemPrompt).not.toContain("约 20 字");
    expect(systemPrompt).toContain("输出形态以任务规格为准");
    expect(systemPrompt).toContain("禁止再带 tool_calls");
    expect(systemPrompt).toContain(`<${PROMPT_XML_TAGS.autoLlmTaskSpec}`);
    expect(systemPrompt).toContain('kind="cron"');
    expect(systemPrompt).not.toContain(MEMORY_REFERENCE_CITATION_RULE);
    expect(systemPrompt).not.toContain(SELF_LAYER_SYSTEM_FRAME);
    expect(systemPrompt).not.toContain("digital human");

    expect(userMessages).toHaveLength(2);
    expect(userMessages[0]).toContain(`<${PROMPT_XML_TAGS.skills}>`);
    expect(userMessages[0]).toContain("skill-alpha body");
    expect(userMessages[1]).toContain(`<${PROMPT_XML_TAGS.sourceData}>`);
    expect(userMessages[1]).toContain("job prompt here");
  });

  it("task_params 在 skills 之后、source_data 之前；task_spec 可含挖空", () => {
    const { systemPrompt, userMessages } = composeAutoLlmPrompt({
      kind: "temporal-summary",
      taskSpec: "请为 {{day}}（CST）生成摘要；上限 {{max_chars}} 字。",
      taskParams: { day: "2026-08-11", max_chars: 200 },
      dataParts: [{ body: "material" }],
    });
    expect(systemPrompt).toContain("{{day}}");
    expect(systemPrompt).toContain("{{max_chars}}");
    expect(systemPrompt).not.toContain("2026-08-11");
    expect(userMessages).toHaveLength(2);
    expect(userMessages[0]).toContain(`<${PROMPT_XML_TAGS.autoLlmTaskParams}>`);
    expect(userMessages[0]).toContain("day: 2026-08-11");
    expect(userMessages[0]).toContain("max_chars: 200");
    expect(userMessages[1]).toContain(`<${PROMPT_XML_TAGS.sourceData}>`);
    expect(userMessages[1]).toContain("material");
  });

  it("自定义 data 标签拆成独立 user 消息", () => {
    const { userMessages } = composeAutoLlmPrompt({
      kind: "subagent",
      taskSpec: "完整答复。",
      taskParams: { slug: "explorer" },
      dataParts: [
        { tag: PROMPT_XML_TAGS.subagentRole, body: "只读探索。" },
        { tag: PROMPT_XML_TAGS.subagentGoal, body: "列出文件" },
      ],
    });
    expect(userMessages).toHaveLength(3);
    expect(userMessages[0]).toContain(`<${PROMPT_XML_TAGS.autoLlmTaskParams}>`);
    expect(userMessages[1]).toContain(`<${PROMPT_XML_TAGS.subagentRole}>`);
    expect(userMessages[1]).toContain("只读探索。");
    expect(userMessages[2]).toContain(`<${PROMPT_XML_TAGS.subagentGoal}>`);
    expect(userMessages[2]).toContain("列出文件");
  });

  it("无 skills/data 时仅 system", () => {
    const { systemPrompt, userMessages } = composeAutoLlmPrompt({
      kind: "conversation-title",
      taskSpec: "为会话生成短标题。",
    });
    expect(systemPrompt).toContain("conversation-title");
    expect(userMessages).toEqual([]);
  });
});
