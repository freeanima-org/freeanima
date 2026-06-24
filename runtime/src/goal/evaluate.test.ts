import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as goalJudge from "@freeanima/core/llm/goal-judge";
import { Config, animaConfigSchema } from "@freeanima/core/config";
import type { LlmRuntime } from "@freeanima/core/llm";
import { evaluateGoalAfterTurn } from "./evaluate.ts";
import { pauseConversationGoal, setConversationGoal } from "./manager.ts";
import type { ConversationPort } from "@freeanima/core/tool/conversation-port";

function createMemoryConversation(): ConversationPort {
  const state = { meta: { role: "conversation_meta", model: "m" } as Record<string, unknown> };
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
  animaConfigSchema.parse({
    llm: {
      default_profile: "chat",
      providers: {
        main: { backend: "openai_compatible", base_url: "http://127.0.0.1:1" },
      },
      profiles: {
        chat: { chain: [{ provider: "main", model: "test-model" }] },
      },
    },
    remote_auth: { token: "test-remote-auth-token-min16" },
  }),
);
const llm = {} as LlmRuntime;

describe("evaluateGoalAfterTurn", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const s of restores) s.mockRestore();
    restores.length = 0;
  });

  it("returns stop when no goal", async () => {
    const conv = createMemoryConversation();
    const r = await evaluateGoalAfterTurn(
      { conversation: conv, llm, config: testConfig.data },
      "s1",
      [{ role: "assistant", content: "done" }],
    );
    expect(r.action).toBe("stop");
  });

  it("returns stop when paused", async () => {
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    await pauseConversationGoal(conv, "s1");
    const r = await evaluateGoalAfterTurn(
      { conversation: conv, llm, config: testConfig.data },
      "s1",
      [{ role: "assistant", content: "x" }],
    );
    expect(r.action).toBe("stop");
  });

  it("continues on judge not done (fail-open on judge error)", async () => {
    restores.push(spyOn(goalJudge, "judgeGoal").mockResolvedValue({ ok: false, error: "network" }));
    const conv = createMemoryConversation();
    await setConversationGoal(conv, "s1", "task");
    const r = await evaluateGoalAfterTurn(
      { conversation: conv, llm, config: testConfig.data },
      "s1",
      [{ role: "assistant", content: "working" }],
    );
    expect(r.action).toBe("continue");
    if (r.action === "continue") {
      expect(r.continuePrompt).toContain("Continuing toward goal");
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
    const r = await evaluateGoalAfterTurn(
      { conversation: conv, llm, config: testConfig.data },
      "s1",
      [{ role: "assistant", content: "完成" }],
    );
    expect(r.action).toBe("stop");
    expect(r.displayHint).toContain("Goal achieved");
  });
});
