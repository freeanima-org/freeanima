import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/core/tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/core/tokenizer/testing";
import type { SemanticMemoryRow } from "@freeanima/core/db/schema/rows";

const listResidentSemanticMemoryMock = mock(async () => [] as SemanticMemoryRow[]);

mock.module("@freeanima/core/db/pg/semantic-memory", () => ({
  listResidentSemanticMemory: listResidentSemanticMemoryMock,
}));
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { createEngineCatalog } from "@freeanima/runtime";
import type { Engine } from "@freeanima/runtime";
import { Config } from "@freeanima/core/config";
import type { Kernel } from "@freeanima/kernel";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { bindEnginePorts } from "./bind-engine-ports.ts";
import { registerSystemPromptHooks } from "./register-prompt-hooks.ts";
import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";
import { initRuntimeContext } from "./context.ts";
import { createAppRuntime } from "./runtime/app-runtime.ts";
import type { RuntimeDeps } from "./runtime/runtime-deps.ts";
import { computeGlobalBreakdown, getPromptDebug } from "./runtime/service-prompt-debug.ts";

const mockParts = {
  self: "self block",
  agents: "agents block",
  resident: "resident block",
  toolsets: "toolsets block",
};

const mockConv = {
  conversationExists: mock(async (id: string) => id === "sess_ok"),
  loadConversationMeta: mock(async () => ({
    role: "conversation_meta" as const,
    model: "gpt-4",
    cached_toolsets: ["file"],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    system_prompt: "",
    cwd: "/tmp/project",
  })),
  loadConversationTools: mock(async () => [
    {
      type: "function" as const,
      function: {
        name: "file_read",
        description: "Read a text file",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
  ]),
  buildRuntimeMessages: mock(async () => [[], null] as const),
};

const minimalConfig = Config.fromSnapshot({
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "test",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "gpt-4" }] } },
  },
});

let testDeps: RuntimeDeps;

function seedContext(catalog: ReturnType<typeof createEngineCatalog>, kernel: Kernel) {
  const runtime = createAppRuntime({
    conversation: mockConv as never,
    kernel,
    engine: {
      catalog,
      config: minimalConfig,
      logger: createTestLogger(),
    } as Engine,
    mcp: null,
    satellite: null,
    acp: {} as never,
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  });
  initRuntimeContext(runtime);
  testDeps = runtime.runtimeDeps();
}

type PromptDebugToolItem = Awaited<ReturnType<typeof getPromptDebug>>["tools"]["items"][number];

describe("service-prompt-debug", () => {
  let catalog: ReturnType<typeof createEngineCatalog>;

  beforeEach(async () => {
    resetRegisterServiceToolsForTest();
    bindEnginePorts();
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text: string) => {
      const len = text.trim().length;
      if (!len) return [];
      const n = Math.max(1, Math.ceil(len / 3.5));
      return Array.from({ length: n }, (_, i) => i + 1);
    });
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("");
    catalog = createEngineCatalog();
    registerServiceTools({
      toolSets: catalog.toolSets,
      skills: catalog.skills,
      config: minimalConfig,
    });
    listResidentSemanticMemoryMock.mockClear();
    const kernel = createServiceKernel(minimalConfig);
    registerSystemPromptHooks({
      hookRegistry: kernel.hookRegistry,
      getToolRegistry: () => catalog.toolSets,
    });
    seedContext(catalog, kernel);
    mockConv.conversationExists.mockClear();
    mockConv.loadConversationMeta.mockClear();
    mockConv.loadConversationTools.mockClear();
    mockConv.buildRuntimeMessages.mockClear();
  });

  afterEach(() => {
    resetTokenizerForTest();
  });

  it("computeGlobalBreakdown counts only system and tools breakdown", () => {
    const items: PromptDebugToolItem[] = [
      {
        name: "file_read",
        description: "Read file",
        parameters: { type: "object" },
      },
    ];
    const breakdown = computeGlobalBreakdown(testDeps, mockParts, items);
    expect(breakdown.system_self).toBeGreaterThan(0);
    expect(breakdown.system_agents).toBeGreaterThan(0);
    expect(breakdown.system_resident).toBeGreaterThan(0);
    expect(breakdown.system_toolsets).toBeGreaterThan(0);
    expect(breakdown.messages).toBe(0);
    expect(breakdown.summary).toBe(0);
    expect(breakdown.tools).toBeGreaterThan(0);
    expect(breakdown.total).toBe(
      breakdown.system_self +
        breakdown.system_agents +
        breakdown.system_resident +
        breakdown.system_toolsets +
        breakdown.tools,
    );
  });

  it("global mode returns registry tools and composed prompt", async () => {
    const out = await getPromptDebug(testDeps);
    expect(out.mode).toBe("global");
    expect(out.system.composed.length).toBeGreaterThan(0);
    expect(out.tools.mode).toBe("registry");
    expect(out.tools.count).toBeGreaterThan(0);
    expect(out.tools.items.every((t) => t.parameters && t.name)).toBe(true);
    expect(out.meta).toBeUndefined();
  });

  it("throws when conversation does not exist", async () => {
    await expect(getPromptDebug(testDeps, "missing")).rejects.toThrow("Conversation not found");
  });

  it("conversation mode compares stored vs live and returns effective tools", async () => {
    const preview = await getPromptDebug(testDeps, "sess_ok");
    mockConv.loadConversationMeta.mockImplementation(async () => ({
      role: "conversation_meta" as const,
      model: "gpt-4",
      cached_toolsets: ["file"],
      functions: [],
      timestamp: "2026-01-01T00:00:00+08:00",
      system_prompt: preview.system.composed,
      cwd: "/tmp/project",
    }));

    const out = await getPromptDebug(testDeps, "sess_ok");
    expect(out.mode).toBe("conversation");
    expect(out.conversation_id).toBe("sess_ok");
    expect(out.system.in_sync).toBe(true);
    expect(out.system.stored).toBe(preview.system.composed);
    expect(out.system.composed).toBe(preview.system.composed);
    expect(out.tools.mode).toBe("conversation");
    expect(out.tools.items.some((t) => t.name === "file_read")).toBe(true);
    expect(out.meta?.cwd).toBe("/tmp/project");
    expect(out.meta?.tool_names).toEqual(["file"]);
  });
});
