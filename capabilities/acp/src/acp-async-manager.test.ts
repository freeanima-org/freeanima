import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/core/config";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/platform/config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { createTestAcpManager } from "./test-helpers/manager.ts";
import type { AcpProgressDeliveryPort } from "./ports/progress-delivery.ts";

function acpMinimalConfig() {
  const raw = parseYaml(
    [MINIMAL_LLM_YAML.trim(), "acp_agents:", "  cursor:", "    command: echo"].join("\n"),
  );
  const parsed = animaConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

describe("AcpManager async progress polling", () => {
  it("pollProgress pushes updated tasks to delivery port", async () => {
    const delivered: string[] = [];
    const port: AcpProgressDeliveryPort = {
      deliverProgress: async (_task, body) => {
        delivered.push(body);
      },
      deliverResult: async () => {},
      deliverError: async () => {},
    };

    const { mgr } = createTestAcpManager(acpMinimalConfig());
    mgr.wireConversation({
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "parlor",
      }),
      updateSessionMetaField: async () => {},
    });
    mgr.wireProgressDelivery(port);
    mgr.registerTools();

    const store = (mgr as unknown as { taskStore: { set: (t: unknown) => void } }).taskStore;
    const now = Date.now();
    store.set({
      taskId: "t1",
      agentName: "cursor",
      acpSessionId: "s1",
      animaSessionId: "n1",
      mode: "agent",
      status: "running",
      startedAt: now,
      lastProgressAt: now,
      progressNotes: ["doing work"],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });

    await mgr.pollProgress();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain("doing work");

    await mgr.pollProgress();
    expect(delivered).toHaveLength(1);
  });

  it("cancelAsyncTask returns error for unknown task", () => {
    const { mgr } = createTestAcpManager(acpMinimalConfig());
    mgr.registerTools();
    const out = (mgr as unknown as { cancelAsyncTask: (id: string) => string }).cancelAsyncTask(
      "missing",
    );
    expect(out).toContain("error");
  });
});
