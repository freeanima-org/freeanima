import { describe, it, expect, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { resetConfigForTest, setConfigForTest } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { AcpManager } from "./manager.ts";
import type { AcpProgressDeliveryPort } from "./ports/progress-delivery.ts";

function acpMinimalConfig() {
  const raw = parseYaml(
    [MINIMAL_LLM_YAML.trim(), "acp_agents:", "  cursor:", "    command: echo"].join("\n"),
  );
  const parsed = animaConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("AcpManager 异步进度轮询", () => {
  afterEach(() => {
    resetConfigForTest();
  });

  it("pollProgress 向 delivery port 推送有更新的任务", async () => {
    setConfigForTest(acpMinimalConfig());
    const delivered: string[] = [];
    const port: AcpProgressDeliveryPort = {
      deliverProgress: async (_task, body) => {
        delivered.push(body);
      },
      deliverResult: async () => {},
      deliverError: async () => {},
    };

    const mgr = new AcpManager();
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

  it("cancelAsyncTask 对未知任务返回错误", () => {
    setConfigForTest(acpMinimalConfig());
    const mgr = new AcpManager();
    mgr.registerTools();
    const out = (mgr as unknown as { cancelAsyncTask: (id: string) => string }).cancelAsyncTask(
      "missing",
    );
    expect(out).toContain("error");
  });
});
