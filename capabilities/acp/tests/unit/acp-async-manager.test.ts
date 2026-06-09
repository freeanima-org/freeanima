import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearConfigCache } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "../../../../tests/helpers/minimal-llm-config.ts";
import { AcpManager } from "../../src/manager.ts";
import type { AcpProgressDeliveryPort } from "../../src/ports/progress-delivery.ts";

describe("AcpManager 异步进度轮询", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    clearConfigCache();
    home = mkdtempSync(join(tmpdir(), "freeanima-acp-async-"));
    process.env.FREEANIMA_HOME = home;
    writeFileSync(
      join(home, "config.yaml"),
      [MINIMAL_LLM_YAML.trim(), "acp_agents:", "  cursor:", "    command: echo"].join("\n"),
    );
  });

  afterEach(() => {
    clearConfigCache();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("pollProgress 向 delivery port 推送有更新的任务", async () => {
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
    const mgr = new AcpManager();
    mgr.registerTools();
    const out = (mgr as unknown as { cancelAsyncTask: (id: string) => string }).cancelAsyncTask(
      "missing",
    );
    expect(out).toContain("error");
  });
});
