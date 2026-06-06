import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { registerAllTools } from "@freeanima/service";
import { testConv } from "../../helpers/pg-test.ts";
import {
  setAwaitingClarify,
  readAwaitingClarify,
  clearAwaitingClarify,
  resolveUserContent,
  guardAwaitingClarify,
  findAwaitingClarifyInMessages,
} from "@freeanima/capabilities-clarify";
import { executeCommand, getCommand } from "@freeanima/service";

describePg("clarify session", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-clarify-");
    registerAllTools();
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  async function createSession(id: string): Promise<void> {
    await testConv().initSession(id, "test-model", { platform: "parlor" });
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

    const merged = await resolveUserContent(c, "s1", "我的回答");
    expect(merged).toContain("Q1?");
    expect(merged).toContain("Q2?");
    expect(merged).toContain("我的回答");
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
    expect((await guardAwaitingClarify(c, "s1", "我的回答")).ok).toBe(true);
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

    const merged = await resolveUserContent(c, "s1", "新消息");
    expect(merged).toContain("超时作废");
    expect(merged).toContain("新消息");
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
      sessionId: "s1",
      platform: "parlor",
      args: [],
      raw: "/cancel",
    });
    expect(result.text).toContain("已取消");
    expect(await readAwaitingClarify(c, "s1")).toBeNull();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
