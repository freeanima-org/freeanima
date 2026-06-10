import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";
import {
  registerSemanticMemoryStore,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/life-memory";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { createEngineCatalog } from "@freeanima/engine";
import type { Engine } from "@freeanima/engine";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";
import { initServiceContext } from "./context.ts";
import { computeGlobalBreakdown, getPromptDebug } from "./runtime/service-prompt-debug.ts";

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
    tools: ["file_read_file"],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    system_prompt: "",
    cwd: "/tmp/project",
  })),
  loadSessionTools: mock(async () => [
    {
      type: "function" as const,
      function: {
        name: "file_read_file",
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

function seedContext(catalog: ReturnType<typeof createEngineCatalog>) {
  initServiceContext({
    conversation: mockConv as never,
    service: {} as never,
    kernel: {} as never,
    engine: { catalog, repos: nullPgRepositories } as Engine,
    mcp: {} as never,
    acp: {} as never,
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  });
}

type PromptDebugToolItem = Awaited<ReturnType<typeof getPromptDebug>>["tools"]["items"][number];

describe("service-prompt-debug", () => {
  let catalog: ReturnType<typeof createEngineCatalog>;

  beforeEach(() => {
    resetRegisterServiceToolsForTest();
    catalog = createEngineCatalog();
    registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills });
    registerSemanticMemoryStore(emptySemanticStore);
    seedContext(catalog);
    mockConv.sessionExists.mockClear();
    mockConv.loadSessionMeta.mockClear();
    mockConv.loadSessionTools.mockClear();
    mockConv.buildRuntimeMessages.mockClear();
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("computeGlobalBreakdown counts only system and tools breakdown", () => {
    const items: PromptDebugToolItem[] = [
      {
        name: "file_read_file",
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

  it("global mode returns registry tools and composed prompt", async () => {
    const out = await getPromptDebug();
    expect(out.mode).toBe("global");
    expect(out.system.composed.length).toBeGreaterThan(0);
    expect(out.tools.mode).toBe("registry");
    expect(out.tools.count).toBeGreaterThan(0);
    expect(out.tools.items.every((t) => t.parameters && t.name)).toBe(true);
    expect(out.meta).toBeUndefined();
  });

  it("throws when session does not exist", async () => {
    await expect(getPromptDebug("missing")).rejects.toThrow("Session not found");
  });

  it("session mode compares stored vs live and returns effective tools", async () => {
    const preview = await getPromptDebug("sess_ok");
    mockConv.loadSessionMeta.mockImplementation(async () => ({
      role: "session_meta" as const,
      model: "gpt-4",
      tools: ["file_read_file"],
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
    expect(out.tools.items.some((t) => t.name === "file_read_file")).toBe(true);
    expect(out.meta?.cwd).toBe("/tmp/project");
    expect(out.meta?.tool_names).toEqual(["file_read_file"]);
  });
});
