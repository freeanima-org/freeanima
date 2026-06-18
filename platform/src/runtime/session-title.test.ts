import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as sessionTitleLlm from "@freeanima/core/llm";
import { createConversationService } from "@freeanima/runtime/conversation";
import { nullPgRepositories } from "@freeanima/core/repos";
import { MaskRegistry } from "@freeanima/capabilities-tasks/mask";
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
  maybeGenerateSessionTitleAsync,
  resetSessionTitleGenerationForTests,
} from "./session-title.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  repos: nullPgRepositories,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function wireTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(nullPgRepositories, catalog.toolSets);
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

describe("maybeGenerateSessionTitleAsync", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetSessionTitleGenerationForTests();
  });

  it("skips when session already has a title", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getSessionTitle").mockResolvedValue("existing");
    const gen = spyOn(sessionTitleLlm, "generateSessionTitle");
    restores.push(getTitle, gen);

    maybeGenerateSessionTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).not.toHaveBeenCalled();
  });

  it("skips when message count is not 1", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getSessionTitle").mockResolvedValue("");
    const count = spyOn(deps.conversation, "countMessages").mockResolvedValue(2);
    const gen = spyOn(sessionTitleLlm, "generateSessionTitle");
    restores.push(getTitle, count, gen);

    maybeGenerateSessionTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).not.toHaveBeenCalled();
  });

  it("sets title and notifies on success", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getSessionTitle").mockResolvedValue("");
    const count = spyOn(deps.conversation, "countMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateSessionTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setSessionTitle").mockResolvedValue(undefined);
    restores.push(getTitle, count, gen, setTitle);

    const notified: string[] = [];
    maybeGenerateSessionTitleAsync(deps, "sid", "hello", {
      bus: null,
      onSessionUpdated: (sid) => {
        notified.push(sid);
      },
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(setTitle).toHaveBeenCalledWith("sid", "LLM title");
    expect(notified).toEqual(["sid"]);
  });

  it("skips duplicate in-flight generation for same session", async () => {
    const deps = wireTestDeps();
    const getTitle = spyOn(deps.conversation, "getSessionTitle").mockResolvedValue("");
    const count = spyOn(deps.conversation, "countMessages").mockResolvedValue(1);
    let resolveGen: (v: { ok: true; title: string }) => void = () => {};
    const genPending = new Promise<{ ok: true; title: string }>((resolve) => {
      resolveGen = resolve;
    });
    const gen = spyOn(sessionTitleLlm, "generateSessionTitle").mockImplementation(() => genPending);
    const setTitle = spyOn(deps.conversation, "setSessionTitle").mockResolvedValue(undefined);
    restores.push(getTitle, count, gen, setTitle);

    maybeGenerateSessionTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));
    maybeGenerateSessionTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(gen).toHaveBeenCalledTimes(1);

    resolveGen({ ok: true, title: "Once" });
    await new Promise((r) => setTimeout(r, 0));
    expect(setTitle).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite when title appears before LLM returns", async () => {
    const deps = wireTestDeps();
    let titleReads = 0;
    const getTitle = spyOn(deps.conversation, "getSessionTitle").mockImplementation(async () => {
      titleReads += 1;
      return titleReads === 1 ? "" : "manual title";
    });
    const count = spyOn(deps.conversation, "countMessages").mockResolvedValue(1);
    const gen = spyOn(sessionTitleLlm, "generateSessionTitle").mockResolvedValue({
      ok: true,
      title: "LLM title",
    });
    const setTitle = spyOn(deps.conversation, "setSessionTitle").mockResolvedValue(undefined);
    restores.push(getTitle, count, gen, setTitle);

    maybeGenerateSessionTitleAsync(deps, "sid", "hello");
    await new Promise((r) => setTimeout(r, 0));

    expect(setTitle).not.toHaveBeenCalled();
  });
});
