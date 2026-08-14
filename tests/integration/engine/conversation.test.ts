import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { existsSync } from "node:fs";
import { DEFAULT_CONVERSATION_TOOLSETS } from "@freeanima/habitat/core/tool";
import { registerServiceTools } from "@freeanima/habitat/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { getConversationTools } from "@freeanima/habitat/core/db/pg/conversation";
import * as conversationPg from "@freeanima/habitat/core/db/pg/conversation";
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

  it("creates conversation and appends user message", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    expect(await c.conversationExists(sid)).toBe(true);
    await c.beginTurn(sid, "hello");
    const msgs = await c.load(sid);
    expect(msgs.some((m) => m.role === "user" && m.content === "hello")).toBe(true);
  });

  it("new conversation cwd is isolated temp dir, not process.cwd()", async () => {
    const c = testConv();
    const sid = await c.newConversation("weixin");
    const meta = await c.loadConversationMeta(sid);
    const cwd = isConversationMeta(meta) ? (meta.cwd ?? "") : "";
    expect(cwd).toMatch(/^\/tmp\/anima-cwd-/);
    expect(cwd).not.toBe(process.cwd());
    expect(cwd).toContain(sid.slice(0, 8));
  });

  it("restoreIntegrationHome removes conversation cwd temp dir", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const meta = await c.loadConversationMeta(sid);
    const cwd = isConversationMeta(meta) ? (meta.cwd ?? "") : "";
    expect(cwd).not.toBe("");
    expect(existsSync(cwd)).toBe(true);
    await restoreIntegrationHome(prev);
    expect(existsSync(cwd)).toBe(false);
  });

  it("new conversation writes default cached toolsets and loadConversationTools resolves schemas", async () => {
    const engine = getTestEngine();
    registerServiceTools({
      toolSets: engine.toolSets,
      skills: engine.skills,
      config: getActivePgTestContext()!.config,
    });
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;

    const storedToolsets = await getConversationTools(sid);
    expect(storedToolsets.length).toBeGreaterThan(0);
    expect(storedToolsets.length).toBeLessThan(engine.toolSets.listToolSets().length);
    for (const name of storedToolsets) {
      expect(DEFAULT_CONVERSATION_TOOLSETS.includes(name as never)).toBe(true);
    }
    expect(meta.staged_toolsets ?? []).toEqual([]);

    const tools = await c.loadConversationTools(sid);
    expect(tools.length).toBeGreaterThan(storedToolsets.length);
    expect(tools[0]).toHaveProperty("type", "function");
    expect(tools.some((t) => t.function.name === "toolset_search")).toBe(true);
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
    const sid = await c.newConversation("test");
    for (let i = 0; i < 55; i++) {
      await c.appendMessage({ role: "user", content: `u${i}`, pos: i * 2 + 1 }, sid);
      await c.appendMessage({ role: "assistant", content: `a${i}`, pos: i * 2 + 2 }, sid);
    }

    const countBefore = (await c.load(sid)).length;
    expect(countBefore).toBeGreaterThanOrEqual(100);

    const [msgs, functions, effective] = await c.beginTurn(sid, "new question");
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta) && meta.compression).toBeTruthy();

    msgs.push({ role: "assistant", content: "new reply" });
    await c.finishTurn(sid, msgs, effective, "m", functions);

    expect((await c.load(sid)).length).toBe(countBefore + 2);
  });

  it("beginTurn on compressed conversation uses pos-range load instead of full listMessages", async () => {
    const c = testConv();
    const sid = await c.newConversation("test");
    for (let i = 0; i < 55; i++) {
      await c.appendMessage({ role: "user", content: `u${i}`, pos: i * 2 + 1 }, sid);
      await c.appendMessage({ role: "assistant", content: `a${i}`, pos: i * 2 + 2 }, sid);
    }
    await c.beginTurn(sid, "trigger compression");

    const listSpy = spyOn(conversationPg, "listMessages");
    const rangeSpy = spyOn(conversationPg, "listMessagesByPosRange");

    await c.beginTurn(sid, "window load probe");

    expect(rangeSpy.mock.calls.length).toBeGreaterThan(0);
    expect(listSpy.mock.calls.length).toBe(0);
    listSpy.mockRestore();
    rangeSpy.mockRestore();
  });
});
