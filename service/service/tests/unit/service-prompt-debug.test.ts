import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";
import {
  registerSemanticMemoryStore,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/life-memory";
import { registerServiceTools } from "../../src/register.ts";
import { initServiceContext } from "../../src/context.ts";
import { computeGlobalBreakdown, getPromptDebug } from "../../src/runtime/service-prompt-debug.ts";

const emptySemanticStore = {
  async listResident() {
    return [];
  },
} as unknown as SemanticMemoryStorePort;

const mockParts = {
  self: "self block",
  agents: "agents block",
  resident: "resident block",
};

const mockConv = {
  sessionExists: mock(async (id: string) => id === "sess_ok"),
  loadSessionMeta: mock(async () => ({
    role: "session_meta" as const,
    model: "gpt-4",
    tools: ["read_file"],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    system_prompt: "",
    cwd: "/tmp/project",
  })),
  loadSessionTools: mock(async () => [
    {
      type: "function" as const,
      function: {
        name: "read_file",
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

function seedContext() {
  initServiceContext({
    conversation: mockConv as never,
    service: {} as never,
    kernel: {} as never,
    engine: {} as never,
    mcp: {} as never,
    acp: {} as never,
    host: "127.0.0.1",
    port: 2658,
  });
}

type PromptDebugToolItem = Awaited<ReturnType<typeof getPromptDebug>>["tools"]["items"][number];

describe("service-prompt-debug", () => {
  beforeEach(() => {
    registerServiceTools();
    registerSemanticMemoryStore(emptySemanticStore);
    seedContext();
    mockConv.sessionExists.mockClear();
    mockConv.loadSessionMeta.mockClear();
    mockConv.loadSessionTools.mockClear();
    mockConv.buildRuntimeMessages.mockClear();
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("computeGlobalBreakdown 只统计 system 与 tools 分项", () => {
    const items: PromptDebugToolItem[] = [
      {
        name: "read_file",
        description: "Read file",
        parameters: { type: "object" },
      },
    ];
    const breakdown = computeGlobalBreakdown(mockParts, items);
    expect(breakdown.system_self).toBeGreaterThan(0);
    expect(breakdown.system_agents).toBeGreaterThan(0);
    expect(breakdown.system_resident).toBeGreaterThan(0);
    expect(breakdown.messages).toBe(0);
    expect(breakdown.summary).toBe(0);
    expect(breakdown.tools).toBeGreaterThan(0);
    expect(breakdown.total).toBe(
      breakdown.system_self + breakdown.system_agents + breakdown.system_resident + breakdown.tools,
    );
  });

  it("global 模式返回 registry 工具与 composed prompt", async () => {
    const out = await getPromptDebug();
    expect(out.mode).toBe("global");
    expect(out.system.composed.length).toBeGreaterThan(0);
    expect(out.tools.mode).toBe("registry");
    expect(out.tools.count).toBeGreaterThan(0);
    expect(out.tools.items.every((t) => t.parameters && t.name)).toBe(true);
    expect(out.meta).toBeUndefined();
  });

  it("session 不存在时抛错", async () => {
    await expect(getPromptDebug("missing")).rejects.toThrow("Session not found");
  });

  it("session 模式对比 stored 与 live，并返回有效工具", async () => {
    const preview = await getPromptDebug("sess_ok");
    mockConv.loadSessionMeta.mockImplementation(async () => ({
      role: "session_meta" as const,
      model: "gpt-4",
      tools: ["read_file"],
      functions: [],
      timestamp: "2026-01-01T00:00:00+08:00",
      system_prompt: preview.system.composed,
      cwd: "/tmp/project",
    }));

    const out = await getPromptDebug("sess_ok");
    expect(out.mode).toBe("session");
    expect(out.session_id).toBe("sess_ok");
    expect(out.system.in_sync).toBe(true);
    expect(out.system.stored).toBe(preview.system.composed);
    expect(out.system.composed).toBe(preview.system.composed);
    expect(out.tools.mode).toBe("session");
    expect(out.tools.items.some((t) => t.name === "read_file")).toBe(true);
    expect(out.meta?.cwd).toBe("/tmp/project");
    expect(out.meta?.tool_names).toEqual(["read_file"]);
  });
});
