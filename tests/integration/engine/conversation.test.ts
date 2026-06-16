import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/core/db/domain";
import { DEFAULT_SESSION_TOOLSETS } from "@freeanima/core/tool";
import { registerServiceTools } from "@freeanima/platform";
import { getActivePgTestContext, getTestEngine, testConv } from "../../helpers/pg-test.ts";

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

  it("new session writes default cached toolsets and loadSessionTools resolves schemas", async () => {
    const engine = getTestEngine();
    registerServiceTools({
      toolSets: engine.toolSets,
      skills: engine.skills,
      config: getActivePgTestContext()!.config,
    });
    const c = testConv();
    const sid = await c.newSession("parlor");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    const storedToolsets = await c.repos.session.getSessionTools(sid);
    expect(storedToolsets.length).toBeGreaterThan(0);
    expect(storedToolsets.length).toBeLessThan(engine.toolSets.listToolSets().length);
    for (const name of storedToolsets) {
      expect(DEFAULT_SESSION_TOOLSETS.includes(name as never)).toBe(true);
    }
    expect(meta.staged_toolsets ?? []).toEqual([]);

    const tools = await c.loadSessionTools(sid);
    expect(tools.length).toBeGreaterThan(storedToolsets.length);
    expect(tools[0]).toHaveProperty("type", "function");
    expect(tools.some((t) => t.function.name === "toolsets_search")).toBe(true);
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

    const [msgs, functions, effective] = await c.beginTurn(sid, "new question");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta) && meta.compression).toBeTruthy();

    msgs.push({ role: "assistant", content: "new reply" });
    await c.finishTurn(sid, msgs, effective, "m", functions);

    expect((await c.load(sid)).length).toBe(countBefore + 2);
  });

  it("beginTurn on compressed session uses pos-range load instead of full listMessages", async () => {
    const c = testConv();
    const sid = await c.newSession("test");
    for (let i = 0; i < 55; i++) {
      await c.appendMessage({ role: "user", content: `u${i}`, pos: i * 2 + 1 }, sid);
      await c.appendMessage({ role: "assistant", content: `a${i}`, pos: i * 2 + 2 }, sid);
    }
    await c.beginTurn(sid, "trigger compression");

    const session = c.repos.session;
    let fullListCalls = 0;
    let rangeListCalls = 0;
    const origList = session.listMessages.bind(session);
    const origRange = session.listMessagesByPosRange.bind(session);
    spyOn(session, "listMessages").mockImplementation(async (sessionId) => {
      fullListCalls++;
      return origList(sessionId);
    });
    spyOn(session, "listMessagesByPosRange").mockImplementation(
      async (sessionId, fromPos, toPos) => {
        rangeListCalls++;
        return origRange(sessionId, fromPos, toPos);
      },
    );

    await c.beginTurn(sid, "window load probe");

    expect(rangeListCalls).toBeGreaterThan(0);
    expect(fullListCalls).toBe(0);
  });
});
