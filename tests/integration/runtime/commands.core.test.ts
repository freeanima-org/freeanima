import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
  syncIntegrationSelfLayer,
} from "../../helpers/integration-case.ts";
import type { PgTestContext } from "../../helpers/pg-test.ts";

import { isConversationMeta } from "@freeanima/host/core/db/domain";
import { getTestEngine, seedSession, testConv } from "../../helpers/pg-test.ts";
import {
  findCommand,
  executeCommand,
  isRetryResult,
  resolveCommand,
  commandNeedsPreAck,
} from "@freeanima/host/capabilities/tools/slash-commands";
import { getAppRuntime } from "@freeanima/host/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import * as engineConversation from "@freeanima/host/engine/conversation";
import { patchConversationMeta } from "@freeanima/host/core/db/pg/conversation";

async function patchMetaForTest(
  conversationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await patchConversationMeta(conversationId, patch);
}

describePg("slash commands (core)", () => {
  let home: string;
  let pg: PgTestContext;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-cmd-");
    home = ctx.home;
    pg = ctx.pg;
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("help lists retry and help", async () => {
    const [cmd] = findCommand("/help");
    expect(cmd?.name).toBe("help");
    const text = (
      await executeCommand(cmd!, {
        conversationId: "x",
        platform: TEST_SAP_CHAT_PLATFORM,
        args: [],
        raw: "/help",
      })
    ).text;
    expect(text).toContain("/retry");
    expect(text).toContain("/goal");
    expect(text).toContain("/help");
    expect(text).toContain("Current conversation");
    expect(text).not.toContain("/new");
  });

  it("retry command returns retry action", async () => {
    const [cmd] = findCommand("/regenerate");
    expect(cmd?.name).toBe("retry");
    const result = await executeCommand(cmd!, {
      conversationId: "x",
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/retry",
    });
    expect(isRetryResult(result)).toBe(true);
  });

  it("rollbackToLastUser removes trailing assistant", async () => {
    const sid = "20260526_160000_retry";
    await seedSession(
      getTestEngine(),
      sid,
      {
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: TEST_SAP_CHAT_PLATFORM,
      },
      [
        { role: "user", content: "hello", pos: 1, timestamp: "t1" },
        { role: "assistant", content: "old reply", pos: 2, timestamp: "t2" },
      ],
    );

    const content = await testConv().rollbackToLastUser(sid);
    expect(content).toBe("hello");
    const msgs = await testConv().load(sid);
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(0);
    expect(msgs.filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("listCommands includes help and retry", async () => {
    const svc = getAppRuntime();
    const chatCommands = svc
      .listCommands({ platform: TEST_SAP_CHAT_PLATFORM })
      .commands.map((c) => c.name);
    expect(chatCommands).toContain("help");
    expect(chatCommands).toContain("retry");
    expect(chatCommands).toContain("rebuild_conversation_cache");
    expect(chatCommands).not.toContain("reload_tools");
    expect(chatCommands).not.toContain("reload_system_prompt");
    expect(chatCommands).not.toContain("new");

    const discord = svc.listCommands({ platform: "discord" }).commands.map((c) => c.name);
    expect(discord).toContain("new");
    expect(discord).toContain("sethome");
  });

  it("resolveCommand blocks /new on chat", async () => {
    expect(resolveCommand("/new", TEST_SAP_CHAT_PLATFORM)[0]).toBeNull();
    expect(resolveCommand("/new", "discord")[0]?.name).toBe("new");
    expect(resolveCommand("/new", "weixin")[0]?.name).toBe("new");
  });

  it("/new creates conversation and returns new_conversation_id", async () => {
    const sid = await testConv().newConversation("discord");
    const [cmd] = findCommand("/new");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: "discord",
      args: [],
      raw: "/new",
    });
    expect(result.text).toContain("New conversation");
    const data = result.data as { new_conversation_id?: string } | undefined;
    expect(data?.new_conversation_id).toBeTruthy();
    expect(String(data?.new_conversation_id)).not.toBe(sid);
    expect(await testConv().conversationExists(String(data?.new_conversation_id))).toBe(true);
  });

  it("/new writes handoff summary as first assistant message without mutating old session", async () => {
    const handoffSpy = spyOn(
      engineConversation,
      "generateConversationHandoffSummary",
    ).mockResolvedValue({
      ok: true,
      summary: "Previous conversation summary",
    });

    try {
      const sid = "20260609_120000_handoff";
      await seedSession(
        getTestEngine(),
        sid,
        {
          model: "test-model",
          cached_toolsets: [],
          staged_toolsets: [],
          functions: [],
          timestamp: new Date().toISOString(),
          platform: "discord",
        },
        [
          { role: "user", content: "hello", pos: 1, timestamp: "t1" },
          { role: "assistant", content: "hi there", pos: 2, timestamp: "t2" },
        ],
      );

      const oldCount = await testConv().countMessages(sid);
      const [cmd] = findCommand("/new");
      const result = await executeCommand(cmd!, {
        conversationId: sid,
        platform: "discord",
        args: [],
        raw: "/new",
      });

      expect(handoffSpy).toHaveBeenCalled();
      expect(await testConv().countMessages(sid)).toBe(oldCount);

      const newSid = String((result.data as { new_conversation_id?: string })?.new_conversation_id);
      const msgs = await testConv().load(newSid);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]?.role).toBe("assistant");
      expect(msgs[0]?.content).toBe("Previous conversation summary");
    } finally {
      handoffSpy.mockRestore();
    }
  });

  it("rebuild_conversation_cache promotes staged toolsets and rebuilds system_prompt", async () => {
    const selfModel = "You are a test agent.";
    await syncIntegrationSelfLayer(pg, selfModel);

    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const metaBefore = await testConv().loadConversationMeta(sid);
    const preservedCwd = "/tmp/freeanima-preserved-cwd";
    await patchMetaForTest(sid, {
      cwd: preservedCwd,
      cached_toolsets: ["toolset", "memory"],
      staged_toolsets: ["file"],
      system_prompt: "old prompt",
      title: "preserved title",
    });

    const [cmd] = findCommand("/rebuild_conversation_cache");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/rebuild_conversation_cache",
    });
    expect(result.text).toContain("Rebuilt conversation cache");
    expect(result.text).toContain("cached_toolsets:");
    expect(result.text).toContain("promoted: file");

    const metaAfter = await testConv().loadConversationMeta(sid);
    expect(isConversationMeta(metaAfter)).toBe(true);
    if (!isConversationMeta(metaAfter)) return;
    expect(metaAfter.cached_toolsets).toContain("file");
    expect(metaAfter.staged_toolsets ?? []).toEqual([]);
    expect(metaAfter.cwd).toBe(preservedCwd);
    expect(metaAfter.title).toBe("preserved title");
    expect(metaAfter.model).toBe(metaBefore.model);

    const sp = metaAfter.system_prompt ?? "";
    expect(sp).toContain(selfModel);
    expect(sp).not.toBe("old prompt");
  });

  it("rebuild_conversation_cache on missing conversation returns warning", async () => {
    const [cmd] = findCommand("/rebuild-session-cache");
    const result = await executeCommand(cmd!, {
      conversationId: "nonexistent_session_abc",
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/rebuild_conversation_cache",
    });
    expect(result.text).toContain("does not exist");
  });

  it("rebuild_conversation_cache seeds default toolsets when cached is empty", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    await patchMetaForTest(sid, {
      cached_toolsets: [],
      staged_toolsets: [],
    });

    const [cmd] = findCommand("/rebuild_conversation_cache");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/rebuild_conversation_cache",
    });
    expect(result.text).toContain("Rebuilt conversation cache");

    const metaAfter = await testConv().loadConversationMeta(sid);
    expect(isConversationMeta(metaAfter)).toBe(true);
    if (!isConversationMeta(metaAfter)) return;
    expect(metaAfter.cached_toolsets.length).toBeGreaterThan(0);
  });

  it("stats command reports conversation", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const [cmd] = findCommand("/stats");
    expect(cmd?.name).toBe("stats");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/stats",
    });
    expect(result.text).toContain("Conversation:");
  });

  it("title command get and set", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const [setCmd] = findCommand("/title");
    await executeCommand(setCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: ["my title"],
      raw: "/title my title",
    });
    expect(await testConv().getConversationTitle(sid)).toBe("my title");
    const [getCmd] = findCommand("/title");
    const result = await executeCommand(getCmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/title",
    });
    expect(result.text).toContain("my title");
  });

  it("compress command reports compression state", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const [cmd] = findCommand("/compress");
    expect(cmd?.name).toBe("compress");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/compress",
    });
    expect(result.text).toContain("l3");
    expect(result.text).toContain("stored");
  });

  it("summarize command is registered and reports empty conversation", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const [cmd] = findCommand("/summarize");
    expect(cmd?.name).toBe("summarize");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/summarize",
    });
    expect(result.text).toContain("No conversation content");
  });

  it("summarize needs pre-ack", () => {
    const [cmd] = findCommand("/summarize");
    expect(cmd?.name).toBe("summarize");
    expect(commandNeedsPreAck(cmd!, [])).toBe(true);
  });

  it("cwd command uses existing directory", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    const [cmd] = findCommand("/cwd");
    const result = await executeCommand(cmd!, {
      conversationId: sid,
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [home],
      raw: `/cwd ${home}`,
    });
    expect(result.text).toContain("Working directory switched");
    expect(await testConv().getConversationCwd(sid)).toBe(home);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
