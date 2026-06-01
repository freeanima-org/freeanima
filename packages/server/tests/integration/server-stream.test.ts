import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

describePg("sendMessageStream", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-stream-");
    home = ctx.home;
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("unknown slash command yields token and done without LLM", async () => {
    const { NestService } = await import("@freeanima/core");
    const { seedSession } = await import("@freeanima/db/test-helpers");
    const sid = "20260526_150000_test";
    await seedSession(sid, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    const svc = new NestService();
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