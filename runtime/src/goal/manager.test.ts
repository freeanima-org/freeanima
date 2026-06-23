import { describe, it, expect, beforeEach } from "bun:test";
import {
  addSubgoal,
  clearGoal,
  clearSubgoals,
  formatGoalStatus,
  pauseSessionGoal,
  removeSubgoal,
  resumeSessionGoal,
  setSessionGoal,
} from "./manager.ts";
import { readSessionGoal } from "./store.ts";
import type { SessionConversationPort } from "@freeanima/core/tool/session-conversation-port";

function createMemoryConversation(): SessionConversationPort & {
  meta: Record<string, unknown>;
} {
  const state = {
    meta: { role: "session_meta", model: "m", goal: undefined } as Record<string, unknown>,
  };
  return {
    get meta() {
      return state.meta;
    },
    async loadSessionMeta() {
      return state.meta as never;
    },
    async updateSessionMetaField(_session, patch) {
      Object.assign(state.meta, patch);
    },
  };
}

describe("goal manager", () => {
  let conv: ReturnType<typeof createMemoryConversation>;

  beforeEach(() => {
    conv = createMemoryConversation();
  });

  it("setSessionGoal creates active goal", async () => {
    const goal = await setSessionGoal(conv, "s1", "finish report");
    expect(goal.status).toBe("active");
    expect(goal.description).toBe("finish report");
    expect(goal.max_turns).toBe(20);
    const stored = await readSessionGoal(conv, "s1");
    expect(stored?.description).toBe("finish report");
  });

  it("pause and resume", async () => {
    await setSessionGoal(conv, "s1", "x");
    await pauseSessionGoal(conv, "s1");
    expect((await readSessionGoal(conv, "s1"))?.status).toBe("paused");
    await resumeSessionGoal(conv, "s1");
    expect((await readSessionGoal(conv, "s1"))?.status).toBe("active");
  });

  it("subgoal CRUD", async () => {
    await setSessionGoal(conv, "s1", "main");
    await addSubgoal(conv, "s1", "step a");
    await addSubgoal(conv, "s1", "step b");
    let goal = await readSessionGoal(conv, "s1");
    expect(goal?.subgoals).toEqual(["step a", "step b"]);
    await removeSubgoal(conv, "s1", 1);
    goal = await readSessionGoal(conv, "s1");
    expect(goal?.subgoals).toEqual(["step b"]);
    await clearSubgoals(conv, "s1");
    goal = await readSessionGoal(conv, "s1");
    expect(goal?.subgoals).toEqual([]);
  });

  it("clearGoal removes goal", async () => {
    await setSessionGoal(conv, "s1", "x");
    await clearGoal(conv, "s1");
    expect(await readSessionGoal(conv, "s1")).toBeNull();
  });

  it("formatGoalStatus includes fields", async () => {
    const goal = await setSessionGoal(conv, "s1", "demo");
    const text = formatGoalStatus(goal);
    expect(text).toContain("demo");
    expect(text).toContain("0/20");
  });
});
