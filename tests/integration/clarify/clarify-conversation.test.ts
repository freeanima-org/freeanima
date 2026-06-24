import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { registerServiceTools } from "@freeanima/platform";
import { getActivePgTestContext, getTestEngine, testConv } from "../../helpers/pg-test.ts";
import {
  setAwaitingClarify,
  readAwaitingClarify,
  clearAwaitingClarify,
  resolveUserContent,
  guardAwaitingClarify,
  findAwaitingClarifyInMessages,
} from "@freeanima/capabilities-tools/clarify";
import { executeCommand, getCommand } from "@freeanima/platform/commands";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

describePg("clarify session", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-clarify-");
    const engine = getTestEngine();
    registerServiceTools({
      toolSets: engine.toolSets,
      skills: engine.skills,
      config: getActivePgTestContext()!.config,
    });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  async function createSession(id: string): Promise<void> {
    await testConv().initConversation(id, "test-model", { platform: TEST_SAP_CHAT_PLATFORM });
  }

  it("session A/B awaiting_clarify isolated", async () => {
    const c = testConv();
    await createSession("session_a");
    await createSession("session_b");

    await setAwaitingClarify(c, "session_a", {
      items: [{ question: "A?" }],
      timeout_sec: 1800,
    });

    expect((await readAwaitingClarify(c, "session_a"))?.items[0]?.question).toBe("A?");
    expect(await readAwaitingClarify(c, "session_b")).toBeNull();

    await clearAwaitingClarify(c, "session_a");
    expect(await readAwaitingClarify(c, "session_a")).toBeNull();
  });

  it("resolveUserContent merges batch questions", async () => {
    const c = testConv();
    await createSession("s1");

    await setAwaitingClarify(c, "s1", {
      items: [{ question: "Q1?" }, { question: "Q2?" }],
      timeout_sec: 1800,
    });

    const merged = await resolveUserContent(c, "s1", "my answer");
    expect(merged).toContain("Q1?");
    expect(merged).toContain("Q2?");
    expect(merged).toContain("my answer");
    expect(await readAwaitingClarify(c, "s1")).toBeNull();
  });

  it("guard blocks slash commands while awaiting", async () => {
    const c = testConv();
    await createSession("s1");

    await setAwaitingClarify(c, "s1", {
      items: [{ question: "Q?" }],
      timeout_sec: 1800,
    });

    expect((await guardAwaitingClarify(c, "s1", "/help")).ok).toBe(false);
    expect((await guardAwaitingClarify(c, "s1", "/cancel")).ok).toBe(true);
    expect((await guardAwaitingClarify(c, "s1", "my answer")).ok).toBe(true);
  });

  it("expire clears pending and resolve prepends hint", async () => {
    const c = testConv();
    await createSession("s1");

    await setAwaitingClarify(
      c,
      "s1",
      { items: [{ question: "Q?" }], timeout_sec: 60 },
      { asked_at: new Date(Date.now() - 120_000).toISOString().replace("Z", "+08:00") },
    );

    const merged = await resolveUserContent(c, "s1", "new message");
    expect(merged).toContain("expired");
    expect(merged).toContain("new message");
    expect(await readAwaitingClarify(c, "s1")).toBeNull();
  });

  it("findAwaitingClarifyInMessages reads last clarify tool", () => {
    const msgs = [
      {
        role: "tool",
        name: "clarify",
        content: JSON.stringify({
          status: "awaiting",
          items: [{ question: "Q?" }],
          timeout_sec: 1800,
        }),
      },
    ];
    const pending = findAwaitingClarifyInMessages(msgs);
    expect(pending?.items[0]?.question).toBe("Q?");
  });

  it("/cancel command clears awaiting", async () => {
    const c = testConv();
    await createSession("s1");
    await setAwaitingClarify(c, "s1", {
      items: [{ question: "Q?" }],
      timeout_sec: 1800,
    });

    const cmd = getCommand("cancel")!;
    const result = await executeCommand(cmd, {
      conversationId: "s1",
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/cancel",
    });
    expect(result.text).toContain("cancelled");
    expect(await readAwaitingClarify(c, "s1")).toBeNull();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
