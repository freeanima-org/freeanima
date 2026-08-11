import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/host/engine/conversation";
import * as turn from "@freeanima/host/engine/turn";
import type { StreamEvent } from "@freeanima/host/engine/loop";
import { createConversationService } from "@freeanima/host/engine/conversation";
import { Config } from "@freeanima/host/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/host/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { bindLlmStack } from "@freeanima/host/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/host/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/host/platform/bootstrap";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import { registerBuiltins } from "@freeanima/host/capabilities/tools/slash-commands";
import * as goal from "@freeanima/host/engine/goal";
import * as turnLifecycle from "./turn-lifecycle.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindLlmStack);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

async function bindTestRuntime() {
  registerBuiltins();
  const { createAppRuntime } = await import("./app-runtime.ts");
  const { initRuntimeContext } = await import("../context.ts");
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  const runtime = createAppRuntime({
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    outpost: null,
    host: "127.0.0.1",
    port: 2658,
  });
  initRuntimeContext(runtime);
  return runtime;
}

describe("sendMessageStream slash commands", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  function mockConversationBasics(): void {
    restores.push(
      spyOn(conv, "conversationExists").mockResolvedValue(true),
      spyOn(conv, "assertConversationPlatform").mockResolvedValue(),
      spyOn(conv, "loadConversationMeta").mockResolvedValue({
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: "remote:chat:test",
      }),
    );
  }

  it("/retry yields stream pre-ack before engine tokens", async () => {
    restores.push(
      spyOn(turnLifecycle, "runExclusiveStreamTurn").mockImplementation(
        async function* (): AsyncGenerator<StreamEvent> {
          yield { event: "token", data: { content: "new reply" } };
          yield { event: "done", data: {} };
        },
      ),
    );
    mockConversationBasics();
    restores.push(
      spyOn(turn, "retryTurn").mockResolvedValue([
        [{ role: "user", content: "hi" }],
        [],
        "hi",
      ] as never),
    );

    const app = await bindTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/retry", "remote:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens[0]).toContain("重新生成");
    expect(tokens.at(-1)).toContain("new reply");
  });

  it("/help never yields empty token content", async () => {
    mockConversationBasics();

    const app = await bindTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/help", "remote:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens.some((t) => t.trim().length > 0)).toBe(true);
  });

  it("/compress yields pre-ack before handler result", async () => {
    mockConversationBasics();
    let handlerStarted = false;
    restores.push(
      spyOn(turn, "recompressConversation").mockImplementation(async () => {
        handlerStarted = true;
        return {
          enabled: true,
          updated: true,
          l2: "x",
          l3: null,
          stored_total: 1,
          runtime_message_count: 1,
          hidden_by_compression: 0,
          window_raw: 1,
          recompress_at: 10,
          threshold: 5,
          messages_until_recompress: 3,
          rounds_until_recompress: 1,
        };
      }),
    );

    const app = await bindTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/compress", "remote:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens[0]).toContain("压缩");
    expect(handlerStarted).toBe(true);
    expect(tokens.some((t) => t.includes("Updated compression") || t.includes("l2"))).toBe(true);
  });
});

describe("runConversationCommand Chat RPC", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  function mockConversationBasics(platform = "chat"): void {
    restores.push(
      spyOn(conv, "conversationExists").mockResolvedValue(true),
      spyOn(conv, "assertConversationPlatform").mockResolvedValue(),
      spyOn(conv, "loadConversationMeta").mockResolvedValue({
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform,
      }),
    );
  }

  it("/help returns delivery rpc with panel ux", async () => {
    mockConversationBasics();
    const app = await bindTestRuntime();
    const result = await app.runConversationCommand({
      conversation_id: "test-sid",
      text: "/help",
      platform: "chat",
    });
    expect(result.delivery).toBe("rpc");
    if (result.delivery !== "rpc") return;
    expect(result.ux).toBe("panel");
    expect(result.command).toBe("help");
    expect(result.text).toContain("Available commands");
  });

  it("/retry returns delivery message without executing stream", async () => {
    mockConversationBasics();
    const app = await bindTestRuntime();
    const result = await app.runConversationCommand({
      conversation_id: "test-sid",
      text: "/retry",
      platform: "chat",
    });
    expect(result).toEqual({ delivery: "message" });
  });

  it("/goal <desc> returns delivery message; /goal pause returns toast rpc", async () => {
    mockConversationBasics();
    restores.push(
      spyOn(goal, "pauseConversationGoal").mockResolvedValue({
        description: "ship",
        status: "paused",
        turn_count: 1,
        max_turns: 20,
        subgoals: [],
      } as never),
    );
    const app = await bindTestRuntime();

    const start = await app.runConversationCommand({
      conversation_id: "test-sid",
      text: "/goal ship the feature",
      platform: "chat",
    });
    expect(start).toEqual({ delivery: "message" });

    const pause = await app.runConversationCommand({
      conversation_id: "test-sid",
      text: "/goal pause",
      platform: "chat",
    });
    expect(pause.delivery).toBe("rpc");
    if (pause.delivery !== "rpc") return;
    expect(pause.ux).toBe("toast");
    expect(pause.text).toContain("paused");
  });
});
