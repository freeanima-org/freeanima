import { it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCase, restoreIntegrationHome } from "../../helpers/integration-case.ts";

import * as goalJudge from "@freeanima/core/llm/goal-judge";
import { findCommand, executeCommand, isGoalStartResult } from "@freeanima/platform/slash-commands";
import { getConversationMeta } from "@freeanima/core/db/pg/conversation";
import { seedSession, getTestEngine } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

function newConversationId(): string {
  return `20260623_${Date.now()}_goal`;
}

describePg("goal commands", () => {
  const prev = process.env.FREEANIMA_HOME;
  let judgeSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-goal-");
    judgeSpy = spyOn(goalJudge, "judgeGoal").mockResolvedValue({
      ok: true,
      done: false,
      reason: "仍在进行中",
    });
  });

  afterEach(async () => {
    judgeSpy.mockRestore();
    await restoreIntegrationHome(prev);
  });

  it("registers /goal and /subgoal", async () => {
    const [goalCmd] = findCommand("/goal");
    expect(goalCmd?.name).toBe("goal");
    const [subCmd] = findCommand("/subgoal");
    expect(subCmd?.name).toBe("subgoal");
  });

  it("/goal sets goal and returns goal_start action", async () => {
    const sid = newConversationId();
    await seedSession(getTestEngine(), sid, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    const [cmd] = findCommand("/goal");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["完成", "单元测试"],
      raw: "/goal 完成 单元测试",
    });
    expect(isGoalStartResult(result)).toBe(true);
    expect(result.text).toContain("Goal set");
    if (isGoalStartResult(result)) {
      expect(result.data.prompt).toContain("完成 单元测试");
    }
    const meta = await getConversationMeta(sid);
    expect(meta && "goal" in meta && meta.goal).toBeTruthy();
  });

  it("/goal status shows goal", async () => {
    const sid = newConversationId();
    await seedSession(getTestEngine(), sid, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    const [setCmd] = findCommand("/goal");
    await executeCommand(setCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["demo goal"],
      raw: "/goal demo goal",
    });
    const [statusCmd] = findCommand("/goal status");
    expect(statusCmd).not.toBeNull();
    const status = await executeCommand(statusCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["status"],
      raw: "/goal status",
    });
    expect(status.text).toContain("demo goal");
  });

  it("/subgoal append and list", async () => {
    const sid = newConversationId();
    await seedSession(getTestEngine(), sid, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    const [setCmd] = findCommand("/goal");
    await executeCommand(setCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["main"],
      raw: "/goal main",
    });
    const [subCmd] = findCommand("/subgoal");
    const add = await executeCommand(subCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["step", "one"],
      raw: "/subgoal step one",
    });
    expect(add.text).toContain("step one");
    const list = await executeCommand(subCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/subgoal",
    });
    expect(list.text).toContain("step one");
  });
});
