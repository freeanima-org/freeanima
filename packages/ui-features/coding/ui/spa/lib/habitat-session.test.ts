import { describe, expect, test } from "bun:test";

import {
  buildCodingConversationCreateInput,
  titleFromCodingConversationList,
} from "./habitat-session.ts";

describe("buildCodingConversationCreateInput", () => {
  test("不预填 title，仓名不进会话标题", () => {
    const input = buildCodingConversationCreateInput({
      workspaceRoot: "/home/u/freeanima",
      instanceId: "inst-1",
      projectWorldId: 42,
    });
    expect(input).toEqual({
      platform: "coding",
      scenario: "coding_agent",
      outpost_app_id: "coding",
      outpost_instance_id: "inst-1",
      workspace_root: "/home/u/freeanima",
      project_world_id: 42,
    });
    expect("title" in input).toBe(false);
  });

  test("无工作区 / 无 World 时省略对应字段", () => {
    const input = buildCodingConversationCreateInput({
      workspaceRoot: null,
      instanceId: " inst-2 ",
      projectWorldId: null,
    });
    expect(input.outpost_instance_id).toBe("inst-2");
    expect(input.workspace_root).toBeUndefined();
    expect(input.project_world_id).toBeUndefined();
    expect("title" in input).toBe(false);
  });
});

describe("titleFromCodingConversationList", () => {
  test("按 conversation_id 取非空 title", () => {
    expect(
      titleFromCodingConversationList(
        [
          { conversation_id: "a", title: " 修 IPC  " },
          { conversation_id: "b", title: "" },
        ],
        "a",
      ),
    ).toBe("修 IPC");
    expect(titleFromCodingConversationList([{ conversation_id: "b" }], "b")).toBeNull();
    expect(titleFromCodingConversationList([], "missing")).toBeNull();
  });
});
