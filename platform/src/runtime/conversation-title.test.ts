import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as sessionTitleLlm from "@freeanima/core/llm";
import { createConversationService } from "@freeanima/runtime/conversation";
import { MaskRegistry } from "@freeanima/capabilities-task/mask";
import { Config } from "@freeanima/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/runtime";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/core/llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/capabilities-acp";
import {
  maybeGenerateConversationTitleAsync,
  resetConversationTitleGenerationForTests,
} from "./conversation-title.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function wireTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().wireRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().wireConversation(conversation);
  return {
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    satellite: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
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
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("existing");
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle");
    restores.push(getTitle, gen);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).not.toHaveBeenCalled();
  });

  it("skips when user message count is not 1", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(2);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle");
    restores.push(getTitle, userCount, gen);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).not.toHaveBeenCalled();
  });

  it("generates when only one user message even if total message count grew", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const totalCount = spyOn(deps.conversation, "countMessages").mockResolvedValue(5);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue(undefined);
    restores.push(getTitle, userCount, totalCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).toHaveBeenCalled();
    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
  });

  it("sets title and notifies on success", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue(undefined);
    restores.push(getTitle, userCount, gen, setTitle);

    const notified: string[] = [];
    maybeGenerateConversationTitleAsync(deps, "sid", "hello", {
      bus: null,
      onConversationUpdated: (sid) => {
        notified.push(sid);
      },
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
    expect(notified).toEqual(["sid"]);
  });

  it("prefers emitSessionUpdated over bus/onConversationUpdated", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue(undefined);
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
    await new Promise((r) => setTimeout(r, 0));

    expect(full).toEqual(["sid"]);
    expect(legacy).toEqual([]);
  });

  it("skips duplicate in-flight generation for same session", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getConversationTitle").mockResolvedValue("");
    const userCount = spyOn(deps.conversation, "countUserMessages").mockResolvedValue(1);
    let resolveGen: (v: { ok: true; title: string }) => void = () => {};
    const genPending = new Promise<{ ok: true; title: string }>((resolve) => {
      resolveGen = resolve;
    });
    const gen = spyOn(sessionTitleLlm, "generateConversationTitle").mockImplementation(
      () => genPending,
    );
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue(undefined);
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));
    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).toHaveBeenCalledTimes(1);

    resolveGen({ ok: true, title: "Once" });
    await new Promise((r) => setTimeout(r, 0));
    expect(setTitle).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite when title appears before LLM returns", async () => {
    const deps = wireTestDeps();
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
    const setTitle = spyOn(deps.conversation, "setConversationTitle").mockResolvedValue(undefined);
    restores.push(getTitle, userCount, gen, setTitle);

    maybeGenerateConversationTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(setTitle).not.toHaveBeenCalled();
  });
});
