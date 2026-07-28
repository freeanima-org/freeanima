import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as sessionTitleLlm from "@freeanima/host/core/llm";
import { createConversationService } from "@freeanima/host/engine/conversation";
import { Config } from "@freeanima/host/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/host/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { bindOpenAiCompatibleLlm } from "@freeanima/host/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/host/kernel/logging/testing";
import { createLogger } from "@freeanima/host/kernel/logging";
import { createMemorySink } from "@freeanima/host/kernel/logging/sinks/memory";
import { createServiceKernel } from "@freeanima/host/platform/bootstrap";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/host/capabilities/acp";
import {
  maybeGenerateConversationTitleAsync,
  resetConversationTitleGenerationForTests,
  shouldGenerateConversationTitle,
  triggerConversationTitleIfFirstTurn,
} from "./conversation-title.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function bindTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().bindRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().bindConversation(conversation);
  return {
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    outpost: null,
    acp: getAcpManager(),
    host: "127.0.0.1",
    port: 2658,
  };
}

describe("maybeGenerateConversationTitleAsync", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetConversationTitleGenerationForTests();
  });

  it("skips when conversation already has a title", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("existing");
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle");
    restores.push(getTitle, gen);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).not.toHaveBeenCalled();
  });

  it("skips when user message count is not 1", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(2);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle");
    restores.push(getTitle, userCount, gen);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).not.toHaveBeenCalled();
  });

  it("generates when only one user message even if total message count grew", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const totalCount = spyOn(deps.conversation, "countMessages").mockResolvedValue(5);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, totalCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).toHaveBeenCalled();
    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
  });

  it("sets title and notifies on success", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    const notified: string[] = [];
    maybeGenerateConversationTitleAsync(deps, "sid", "hello", {
      bus: null,
      onConversationUpdated: (sid) => {
        notified.push(sid);
      },
    });
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
    expect(notified).toEqual(["sid"]);
  });

  it("prefers emitSessionUpdated over bus/onConversationUpdated", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    const legacy: string[] = [];
    const full: string[] = [];
    maybeGenerateConversationTitleAsync(deps, "sid", "hello", {
      bus: null,
      onConversationUpdated: (sid) => {
        legacy.push(sid);
      },
      emitSessionUpdated: (sid) => {
        full.push(sid);
      },
    });
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(full).toEqual(["sid"]);
    expect(legacy).toEqual([]);
  });

  it("skips duplicate in-flight generation for same session", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    let resolveGen: (v: { ok: true; title: string }) => void = () => {};
    const genPending = new Promise<{ ok: true; title: string }>((resolve) => {
      resolveGen = resolve;
    });
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockImplementation(
      () => genPending,
    );
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).toHaveBeenCalledTimes(1);

    resolveGen({ ok: true, title: "Once" });
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(setTitle).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite when title appears before LLM returns", async () => {
    const deps = bindTestDeps();
    let titleReads = 0;
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockImplementation(
      async () => {
        titleReads += 1;
        return titleReads === 1 ? "" : "manual title";
      },
    );
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(setTitle).not.toHaveBeenCalled();
  });

  it("firstTurn skips userCount re-check when goal loop added a second user message", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    let countCalls = 0;
    const userCount = spyOn(deps.conversation, "countUserMessages").mockImplementation(async () => {
      countCalls += 1;
      return countCalls === 1 ? 1 : 2;
    });
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello", undefined, { firstTurn: true });
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).toHaveBeenCalled();
    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
    expect(countCalls).toBe(0);
  });

  it("logs warn and uses fallback when LLM fails", async () => {
    const sink = createMemorySink();
    const engine = createEngine({
      catalog,
      config: testConfig,
      llm: initLlmRuntime(testConfig.data),
      logger: createLogger({ level: "debug", sinks: [sink] }),
    });
    const deps = { ...bindTestDeps(), engine };
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: false,
      error: "provider timeout",
      model: "summary-model",
      finish_reason: "length",
      had_reasoning: true,
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue();
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello world");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(setTitle).toHaveBeenCalledWith("sid", "hello world");
    const warn = sink.records.find((r) => r.level === "warn");
    expect(warn?.message).toBe("LLM title failed, using text fallback");
    expect(warn?.attributes).toMatchObject({
      component: "conversation-title",
      conversation_id: "sid",
      error: "provider timeout",
      fallback_title: "hello world",
      model: "summary-model",
      finish_reason: "length",
      had_reasoning: true,
    });
  });

  it("logs error when generation throws", async () => {
    const sink = createMemorySink();
    const engine = createEngine({
      catalog,
      config: testConfig,
      llm: initLlmRuntime(testConfig.data),
      logger: createLogger({ level: "debug", sinks: [sink] }),
    });
    const deps = { ...bindTestDeps(), engine };
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockRejectedValue(
      new Error("db down"),
    );
    restores.push(getTitle, userCount, gen);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    const err = sink.records.find((r) => r.level === "error");
    expect(err?.message).toBe("conversation title generation failed");
    expect(err?.attributes).toMatchObject({
      component: "conversation-title",
      conversation_id: "sid",
    });
  });

  it("triggerConversationTitleIfFirstTurn gates on sync user count", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(2);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle");
    restores.push(getTitle, userCount, gen);

    await triggerConversationTitleIfFirstTurn(deps, "sid", "hello");
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(gen).not.toHaveBeenCalled();
  });

  it("shouldGenerateConversationTitle returns false when title exists", async () => {
    const deps = bindTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("已有");
    const userCount = spyOn(deps.conversation, "countUserMessages");
    restores.push(getTitle, userCount);

    expect(await shouldGenerateConversationTitle(deps, "sid")).toBe(false);
    expect(userCount).not.toHaveBeenCalled();
  });
});
