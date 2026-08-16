import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as goalJudge from "@freeanima/habitat/core/llm/goal-judge";
import { Config, runtimeConfigSchema } from "@freeanima/habitat/core/config";
import type { LlmRuntime } from "@freeanima/habitat/core/llm";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import { evaluateGoalAfterTurn, type GoalRuntimeDeps } from "./evaluate.ts";
import { pauseConversationGoal, setConversationGoal } from "./manager.ts";
import { readConversationGoal } from "./store.ts";
import type { ConversationPort } from "@freeanima/habitat/core/tool/conversation-port.ts";

function createMemoryConversation(): ConversationPort {
  const state = { meta: { model: "m" } as Record<string, unknown> };
  return {
    async loadConversationMeta() {
      return state.meta as never;
    },
    async updateConversationMetaField(_conversation, patch) {
      Object.assign(state.meta, patch);
    },
  };
}

const testConfig = Config.fromSnapshot(
  runtimeConfigSchema.parse({
    llm: {
      default_profile: "chat",
      providers: {
        main: { backend: "openai_compatible", base_url: "http://127.0.0.1:1" },
      },
      profiles: {
        chat: { chain: [{ provider: "main", model: "test-model" }] },
      },
    },
  }),
);
const llm = {} as LlmRuntime;

function depsFor(conv: ConversationPort): GoalRuntimeDeps {
  return {
    conversation: conv,
    llm,
    config: testConfig.data,
    logger: createTestLogger().with({ component: "goal" }),
  };
}

describe("evaluateGoalAfterTurn", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const s of restores) s.mockRestore();
    restores.length = 0;
  });

  it("returns stop when no goal", async () => {
    const conv = createMemoryConversation();
    const r = await evaluateGoalAfterTurn(depsFor(conv), "s1", [
      { role: "assistant", content: "done" },
    ]);
    expect(r.action).toBe("stop");
  });

  it("returns stop when paused", async () => {
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    await pauseConversationGoal(conv, "s1");
    const r = await evaluateGoalAfterTurn(depsFor(conv), "s1", [
      { role: "assistant", content: "x" },
    ]);
    expect(r.action).toBe("stop");
  });

  it("pauses and warns on judge error (do not leave active zombie)", async () => {
    restores.push(spyOn(goalJudge, "judgeGoal").mockResolvedValue({ ok: false, error: "network" }));
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    const logger = createTestLogger().with({ component: "goal" });
    const warnSpy = spyOn(logger, "warn");
    const r = await evaluateGoalAfterTurn(
      { conversation: conv, llm, config: testConfig.data, logger },
      "s1",
      [{ role: "assistant", content: "working" }],
    );
    expect(r.action).toBe("stop");
    expect(r.displayHint).toContain("Goal paused");
    expect(r.displayHint).toContain("judge failed");
    expect(warnSpy).toHaveBeenCalled();
    const goal = await readConversationGoal(conv, "s1");
    expect(goal?.continue_count).toBe(0);
    expect(goal?.last_judge_reason).toBe("network");
    expect(goal?.status).toBe("paused");
  });

  it("continues on judge not done", async () => {
    restores.push(
      spyOn(goalJudge, "judgeGoal").mockResolvedValue({
        ok: true,
        done: false,
        reason: "仍在收集素材",
      }),
    );
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    const r = await evaluateGoalAfterTurn(depsFor(conv), "s1", [
      { role: "assistant", content: "working" },
    ]);
    expect(r.action).toBe("continue");
    if (r.action === "continue") {
      expect(r.continuePrompt).toContain("Continuing toward goal");
      expect(r.continuePrompt).toContain("仍在收集素材");
    }
  });

  it("stops with achieved hint when judge says done", async () => {
    restores.push(
      spyOn(goalJudge, "judgeGoal").mockResolvedValue({
        ok: true,
        done: true,
        reason: "已产出 2 件作品",
      }),
    );
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    const r = await evaluateGoalAfterTurn(depsFor(conv), "s1", [
      { role: "assistant", content: "完成" },
    ]);
    expect(r.action).toBe("stop");
    expect(r.displayHint).toContain("Goal achieved");
  });
});
