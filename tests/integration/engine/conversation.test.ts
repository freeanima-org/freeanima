import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { openaiSchemas } from "@freeanima/engine-tool";
import { isSessionMeta } from "@freeanima/kernel-schemas";
import { registerAllTools } from "@freeanima/legacy-tools";
import {
  newSession,
  load,
  beginTurn,
  sessionExists,
  loadSessionMeta,
  loadSessionTools,
  appendMessage,
  finishTurn,
} from "@freeanima/engine";

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
    const sid = await newSession("parlor");
    expect(await sessionExists(sid)).toBe(true);
    await beginTurn(sid, "hello");
    const msgs = await load(sid);
    expect(msgs.some((m) => m.role === "user" && m.content === "hello")).toBe(true);
  });

  it("new session cwd is isolated temp dir, not process.cwd()", async () => {
    const sid = await newSession("weixin");
    const meta = await loadSessionMeta(sid);
    const cwd = isSessionMeta(meta) ? String(meta.cwd ?? "") : "";
    expect(cwd).toMatch(/^\/tmp\/anima-cwd-/);
    expect(cwd).not.toBe(process.cwd());
    expect(cwd).toContain(sid.slice(0, 8));
  });

  it("new session writes tools snapshot and loadSessionTools uses cache", async () => {
    registerAllTools();
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

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("finishTurn keeps full history under compression", async () => {
    const sid = await newSession("test");
    for (let i = 0; i < 55; i++) {
      await appendMessage({ role: "user", content: `u${i}`, pos: i * 2 + 1 }, sid);
      await appendMessage({ role: "assistant", content: `a${i}`, pos: i * 2 + 2 }, sid);
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
