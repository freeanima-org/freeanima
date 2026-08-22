import { describe, expect, it } from "bun:test";
import { createTestHookRegistry } from "@freeanima/habitat/kernel/hooks/testing";
import {
  PROMPT_XML_TAGS,
  foldSystemPromptSections,
  systemPromptBuild,
} from "@freeanima/habitat/core/hooks/prompt";

import { registerRoomProtocolSystemPromptHook } from "./room-protocol-prompt-hooks.ts";
import { formatRoomMembersPromptBody, formatRoomUtteranceContent } from "./room-service.ts";

describe("formatRoomUtteranceContent", () => {
  it("用 room_utterance 包装正文并带 speaker / public_id", () => {
    const out = formatRoomUtteranceContent("灼华", "pid-zhuohua", "大家好");
    expect(out).toContain(`<${PROMPT_XML_TAGS.roomUtterance}`);
    expect(out).toContain('speaker="灼华"');
    expect(out).toContain('public_id="pid-zhuohua"');
    expect(out).toContain("大家好");
    expect(out).toContain(`</${PROMPT_XML_TAGS.roomUtterance}>`);
  });
});

describe("formatRoomMembersPromptBody", () => {
  it("渲染 member 行含 public_id / kind / self / subject_id", () => {
    const body = formatRoomMembersPromptBody([
      {
        public_id: "pid-user",
        kind: "user",
        display_name: "小草",
        subject_id: 2,
        self: false,
      },
      {
        public_id: "pid-zhuohua",
        kind: "agent",
        display_name: "灼华",
        subject_id: 5,
        self: true,
      },
      {
        public_id: "pid-xiaorou",
        kind: "agent",
        display_name: "小柔",
        subject_id: 8,
        self: false,
      },
    ]);
    expect(body).toContain('public_id="pid-user"');
    expect(body).toContain('kind="user"');
    expect(body).toContain('subject_id="2"');
    expect(body).toContain("小草");
    expect(body).toContain('public_id="pid-zhuohua"');
    expect(body).toContain('kind="agent"');
    expect(body).toContain('self="true"');
    expect(body).toContain("灼华");
    expect(body).toContain('self="false"');
    expect(body).toContain("<member");
  });
});

describe("registerRoomProtocolSystemPromptHook", () => {
  it("仅 room_inner 注入协议段，文案提及 room_members 与唯一用户", async () => {
    const registry = createTestHookRegistry();
    registerRoomProtocolSystemPromptHook(registry);

    const withRoom = await registry.run(
      systemPromptBuild,
      {
        functionNames: [],
        mode: "digital_human",
        meta: {
          model: "m",
          scenario: "room_inner",
        } as never,
      },
      { llm_kind: "conversation" },
    );
    const roomText = foldSystemPromptSections(withRoom.chain);
    expect(roomText).toContain(`<${PROMPT_XML_TAGS.roomContext}`);
    expect(roomText).toContain(PROMPT_XML_TAGS.roomUtterance);
    expect(roomText).toContain(PROMPT_XML_TAGS.roomMembers);
    expect(roomText).toContain("本 Habitat 实例仅有一位人类用户");

    const without = await registry.run(
      systemPromptBuild,
      {
        functionNames: [],
        mode: "digital_human",
        meta: {
          model: "m",
          scenario: "digital_human",
        } as never,
      },
      { llm_kind: "conversation" },
    );
    const plain = foldSystemPromptSections(without.chain);
    expect(plain).not.toContain(`<${PROMPT_XML_TAGS.roomContext}`);
  });
});
