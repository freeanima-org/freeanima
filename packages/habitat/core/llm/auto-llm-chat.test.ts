import { describe, it, expect, spyOn, afterAll, afterEach, mock } from "bun:test";
import type {
  AutoLlmMessageAppendInput,
  AutoLlmRunFinishInput,
  AutoLlmRunInsertRunningInput,
} from "@freeanima/habitat/core/db/pg/auto-llm-run/types";
import * as llm from "./llm.ts";

const persistLog: string[] = [];
const insertCalls: AutoLlmRunInsertRunningInput[] = [];
const appendCalls: Array<{ runId: string; msgs: AutoLlmMessageAppendInput[] }> = [];
const finishCalls: AutoLlmRunFinishInput[] = [];

const realPg = await import("@freeanima/habitat/core/db/pg");
const pgOriginal = { ...realPg };
const realAutoLlmRun = await import("@freeanima/habitat/core/db/pg/auto-llm-run");
const autoLlmRunOriginal = { ...realAutoLlmRun };

mock.module("@freeanima/habitat/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => ({
  ...autoLlmRunOriginal,
  insertRunningAutoLlmRun: mock(async (row: AutoLlmRunInsertRunningInput) => {
    persistLog.push("insert");
    insertCalls.push(row);
  }),
  appendAutoLlmMessages: mock(async (runId: string, msgs: AutoLlmMessageAppendInput[]) => {
    persistLog.push("append");
    appendCalls.push({ runId, msgs });
  }),
  finishAutoLlmRun: mock(async (row: AutoLlmRunFinishInput) => {
    persistLog.push("finish");
    finishCalls.push(row);
  }),
  appendAutoLlmRun: mock(async () => {}),
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg", () => pgOriginal);
  mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => autoLlmRunOriginal);
});

import { runAutoLlmChat } from "./auto-llm-chat.ts";

describe("runAutoLlmChat", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    persistLog.length = 0;
    insertCalls.length = 0;
    appendCalls.length = 0;
    finishCalls.length = 0;
  });

  it("inserts running then appends assistant and finishes ok", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "hello title",
      usage: { prompt_tokens: 12, completion_tokens: 4, cached_tokens: 3 },
      latency_ms: 42,
      model: "test-model",
    });
    restores.push(chatSpy);

    const result = await runAutoLlmChat({
      runName: "conversation-title",
      runKind: "conversation-title",
      subjectId: 2,
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "user" },
      ],
    });

    expect(result.status).toBe("ok");
    expect(result.output).toBe("hello title");
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0]?.run_kind).toBe("conversation-title");
    expect(insertCalls[0]?.messages?.length).toBe(2);
    expect(appendCalls.length).toBe(1);
    expect(appendCalls[0]?.msgs[0]?.payload.role).toBe("assistant");
    expect(appendCalls[0]?.msgs[0]?.payload).toMatchObject({
      role: "assistant",
      content: "hello title",
      usage: { prompt_tokens: 12, completion_tokens: 4, cached_tokens: 3 },
      latency_ms: 42,
      model: "test-model",
    });
    expect(finishCalls.length).toBe(1);
    expect(finishCalls[0]?.status).toBe("ok");
    expect(finishCalls[0]?.output).toBe("hello title");
    expect(persistLog[0]).toBe("insert");
    expect(persistLog.at(-1)).toBe("finish");
  });

  it("finishes error without writing an assistant message", async () => {
    const chatSpy = spyOn(llm, "chat").mockRejectedValue(new Error("boom"));
    restores.push(chatSpy);

    const result = await runAutoLlmChat({
      runName: "goal-judge",
      runKind: "goal-judge",
      subjectId: 2,
      messages: [{ role: "user", content: "judge" }],
    });

    expect(result.status).toBe("error");
    expect(result.output).toBe("");
    expect(insertCalls.length).toBe(1);
    expect(appendCalls.length).toBe(0);
    expect(finishCalls.length).toBe(1);
    expect(finishCalls[0]?.status).toBe("error");
    expect(finishCalls[0]?.output).toBe("");
    expect(finishCalls[0]?.error).toBe("boom");
  });
});
