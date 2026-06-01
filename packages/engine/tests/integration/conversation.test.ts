import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
} from "../../../db/tests/helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/kernel";

describePg("conversation", () => {
  const prev = process.env.FREEANIMA_HOME;
  let home: string;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-conv-");
    home = ctx.home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("creates session and appends user message", async () => {
    const { newSession, load, beginTurn, sessionExists } = await import("@freeanima/core");
    const sid = await newSession("parlor");
    expect(await sessionExists(sid)).toBe(true);
    await beginTurn(sid, "hello");
    const msgs = await load(sid);
    expect(msgs.some((m) => m.role === "user" && m.content === "hello")).toBe(true);
  });

  it("new session cwd is isolated temp dir, not process.cwd()", async () => {
    const { newSession, loadSessionMeta } = await import("@freeanima/core");
    const sid = await newSession("weixin");
    const meta = await loadSessionMeta(sid);
    const cwd = isSessionMeta(meta) ? String(meta.cwd ?? "") : "";
    expect(cwd).toMatch(/^\/tmp\/anima-cwd-/);
    expect(cwd).not.toBe(process.cwd());
    expect(cwd).toContain(sid.slice(0, 8));
  });

  it("new session writes tools snapshot and loadSessionTools uses cache", async () => {
    const { registerAllTools } = await import("@freeanima/tools");
    registerAllTools();
    const { newSession, loadSessionTools, openaiSchemas } = await import("@freeanima/core");
    const sid = await newSession("parlor");
    const tools = await loadSessionTools(sid);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty("type", "function");

    const live = openaiSchemas();
    const cached = await loadSessionTools(sid);
    expect(cached).toEqual(tools);
    expect(cached.length).toBe(live.length);
  });
});

describePg("conversation compression", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCaseWithConfig(
      "anima-conv-compress-",
      "compression:\n  enabled: true\n  max_rounds: 50\n",
    );
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("finishTurn keeps full history under compression", async () => {
    const { newSession, load, appendMessage, beginTurn, finishTurn, loadSessionMeta } =
      await import("@freeanima/core");

    const sid = await newSession("test");
    for (let i = 0; i < 55; i++) {
      await appendMessage({ role: "user", content: `u${i}`, id: i * 2 + 1 }, sid);
      await appendMessage({ role: "assistant", content: `a${i}`, id: i * 2 + 2 }, sid);
    }

    const countBefore = (await load(sid)).length;
    expect(countBefore).toBeGreaterThanOrEqual(100);

    const [msgs, functions, effective] = await beginTurn(sid, "新问题");
    const meta = await loadSessionMeta(sid);
    expect(isSessionMeta(meta) && meta.compression).toBeTruthy();

    msgs.push({ role: "assistant", content: "新回复" });
    await finishTurn(sid, msgs, effective, "m", functions);

    expect((await load(sid)).length).toBe(countBefore + 2);
  });
});
