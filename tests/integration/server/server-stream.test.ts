import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { getAppRuntime } from "@freeanima/platform";
import { getTestEngine, seedSession } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

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
    await seedSession(getTestEngine(), sid, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const svc = getAppRuntime();
    const events: { event: string; data: Record<string, unknown> }[] = [];
    for await (const ev of svc.sendMessageStream(sid, "/unknown-cmd", TEST_SAP_CHAT_PLATFORM)) {
      events.push(ev);
    }

    expect(events.some((e) => e.event === "token")).toBe(true);
    expect(events.filter((e) => e.event === "done")).toHaveLength(1);
    const token = events.find((e) => e.event === "token");
    expect(String(token?.data.content)).toContain("Unknown command");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
