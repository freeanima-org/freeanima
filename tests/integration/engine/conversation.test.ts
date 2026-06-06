import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { openaiSchemas } from "@freeanima/engine-tool";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import { registerAllTools } from "@freeanima/service";
import { testConv } from "../../helpers/pg-test.ts";

describePg("conversation", () => {
  const prev = process.env.FREEANIMA_HOME;
  beforeEach(async () => {
    await beginIntegrationCase("anima-conv-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("creates session and appends user message", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    expect(await c.sessionExists(sid)).toBe(true);
    await c.beginTurn(sid, "hello");
    const msgs = await c.load(sid);
    expect(msgs.some((m) => m.role === "user" && m.content === "hello")).toBe(true);
  });

  it("new session cwd is isolated temp dir, not process.cwd()", async () => {
    const c = testConv();
    const sid = await c.newSession("weixin");
    const meta = await c.loadSessionMeta(sid);
    const cwd = isSessionMeta(meta) ? String(meta.cwd ?? "") : "";
    expect(cwd).toMatch(/^\/tmp\/anima-cwd-/);
    expect(cwd).not.toBe(process.cwd());
    expect(cwd).toContain(sid.slice(0, 8));
  });

  it("new session writes tools snapshot and loadSessionTools uses cache", async () => {
    registerAllTools();
    const c = testConv();
    const sid = await c.newSession("parlor");
    const tools = await c.loadSessionTools(sid);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty("type", "function");

    const live = openaiSchemas();
    const cached = await c.loadSessionTools(sid);
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

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("finishTurn keeps full history under compression", async () => {
    const c = testConv();
    const sid = await c.newSession("test");
    for (let i = 0; i < 55; i++) {
      await c.appendMessage({ role: "user", content: `u${i}`, pos: i * 2 + 1 }, sid);
      await c.appendMessage({ role: "assistant", content: `a${i}`, pos: i * 2 + 2 }, sid);
    }

    const countBefore = (await c.load(sid)).length;
    expect(countBefore).toBeGreaterThanOrEqual(100);

    const [msgs, functions, effective] = await c.beginTurn(sid, "新问题");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta) && meta.compression).toBeTruthy();

    msgs.push({ role: "assistant", content: "新回复" });
    await c.finishTurn(sid, msgs, effective, "m", functions);

    expect((await c.load(sid)).length).toBe(countBefore + 2);
  });
});
