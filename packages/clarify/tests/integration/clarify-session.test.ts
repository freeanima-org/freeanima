import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { registerAllTools } from "@freeanima/tools";
import { initSession } from "@freeanima/engine";
import {
  setAwaitingClarify,
  readAwaitingClarify,
  clearAwaitingClarify,
  resolveUserContent,
  guardAwaitingClarify,
  findAwaitingClarifyInMessages,
  executeCommand,
  getCommand,
} from "@freeanima/clarify";

describePg("clarify session", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-clarify-");
    registerAllTools();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  async function createSession(id: string): Promise<void> {
    await initSession(id, "test-model", { platform: "parlor" });
  }

  it("session A/B awaiting_clarify isolated", async () => {
    await createSession("session_a");
    await createSession("session_b");

    await setAwaitingClarify("session_a", {
      items: [{ question: "A?" }],
      timeout_sec: 1800,
    });

    expect((await readAwaitingClarify("session_a"))?.items[0]?.question).toBe("A?");
    expect(await readAwaitingClarify("session_b")).toBeNull();

    await clearAwaitingClarify("session_a");
    expect(await readAwaitingClarify("session_a")).toBeNull();
  });

  it("resolveUserContent merges batch questions", async () => {
    await createSession("s1");

    await setAwaitingClarify("s1", {
      items: [{ question: "Q1?" }, { question: "Q2?" }],
      timeout_sec: 1800,
    });

    const merged = await resolveUserContent("s1", "我的回答");
    expect(merged).toContain("Q1?");
    expect(merged).toContain("Q2?");
    expect(merged).toContain("我的回答");
    expect(await readAwaitingClarify("s1")).toBeNull();
  });

  it("guard blocks slash commands while awaiting", async () => {
    await createSession("s1");

    await setAwaitingClarify("s1", {
      items: [{ question: "Q?" }],
      timeout_sec: 1800,
    });

    expect((await guardAwaitingClarify("s1", "/help")).ok).toBe(false);
    expect((await guardAwaitingClarify("s1", "/cancel")).ok).toBe(true);
    expect((await guardAwaitingClarify("s1", "我的回答")).ok).toBe(true);
  });

  it("expire clears pending and resolve prepends hint", async () => {
    await createSession("s1");

    await setAwaitingClarify(
      "s1",
      { items: [{ question: "Q?" }], timeout_sec: 60 },
      { asked_at: new Date(Date.now() - 120_000).toISOString().replace("Z", "+08:00") },
    );

    const merged = await resolveUserContent("s1", "新消息");
    expect(merged).toContain("超时作废");
    expect(merged).toContain("新消息");
    expect(await readAwaitingClarify("s1")).toBeNull();
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
    await createSession("s1");
    await setAwaitingClarify("s1", {
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
    expect(await readAwaitingClarify("s1")).toBeNull();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
