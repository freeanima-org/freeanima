import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { AnimaService } from "@freeanima/service";
import { seedSession } from "@freeanima/kernel-db/test-helpers";

describePg("sendMessageStream", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-stream-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("unknown slash command yields token and done without LLM", async () => {
    const sid = "20260526_150000_test";
    await seedSession(sid, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    const svc = new AnimaService();
    const events: { event: string; data: Record<string, unknown> }[] = [];
    for await (const ev of svc.sendMessageStream(sid, "/unknown-cmd", "parlor")) {
      events.push(ev);
    }

    expect(events.some((e) => e.event === "token")).toBe(true);
    expect(events.filter((e) => e.event === "done")).toHaveLength(1);
    const token = events.find((e) => e.event === "token");
    expect(String(token?.data.content)).toContain("未知命令");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
