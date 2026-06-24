import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
  syncIntegrationSelfLayer,
} from "../../helpers/integration-case.ts";
import type { PgTestContext } from "../../helpers/pg-test.ts";

import { isConversationMeta } from "@freeanima/core/db/domain";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  getTestEngine,
  seedSession,
  appendIntegrationConfig,
  testConv,
} from "../../helpers/pg-test.ts";
import {
  findCommand,
  executeCommand,
  isRetryResult,
  isRestartResult,
  isUpgradeResult,
  resolveCommand,
} from "@freeanima/platform/commands";
import { getAppRuntime } from "@freeanima/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import * as engineConversation from "@freeanima/runtime/conversation";

async function patchMetaForTest(
  conversationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await getTestEngine().repos.conversation.patchConversationMeta(conversationId, patch as never);
}

describePg("slash commands", () => {
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
        role: "conversation_meta",
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
          role: "conversation_meta",
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

    const sp = String(metaAfter.system_prompt ?? "");
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

  it("rebuild_conversation_cache seeds default toolsets filtered by capability mask when cached is empty", async () => {
    const sid = await testConv().newConversation(TEST_SAP_CHAT_PLATFORM);
    await patchMetaForTest(sid, {
      cached_toolsets: [],
      staged_toolsets: [],
    });
    await patchMetaForTest(sid, {
      capability_mask: { presets: ["sleep"] },
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
    expect(metaAfter.cached_toolsets).toContain("memory");
    expect(metaAfter.cached_toolsets).not.toContain("toolset");
    expect(metaAfter.cached_toolsets).not.toContain("session");
    expect(metaAfter.cached_toolsets).not.toContain("skill");
    expect(metaAfter.staged_toolsets ?? []).toEqual([]);
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

  it("/sethome writes discord home_channel to config", async () => {
    appendIntegrationConfig(home, "model: test\ndiscord:\n  require_mention: true\n");
    const [cmd] = findCommand("/sethome");
    expect(cmd?.name).toBe("sethome");
    const result = await executeCommand(cmd!, {
      conversationId: "x",
      platform: "discord",
      args: [],
      raw: "/sethome",
      origin_extra: { channel_id: "1234567890123456789", thread_id: "999" },
    });
    expect(result.text).toContain("home channel");
    const cfg = readFileSync(join(home, "config.yaml"), "utf-8");
    expect(cfg).toContain('home_channel: "1234567890123456789"');
    expect(cfg).toContain('home_thread_id: "999"');
  });

  it("/sethome writes weixin home_channel to config", async () => {
    appendIntegrationConfig(home, "model: test\n");
    const [cmd] = findCommand("/sethome");
    const result = await executeCommand(cmd!, {
      conversationId: "x",
      platform: "weixin",
      args: [],
      raw: "/sethome",
      origin_extra: { weixin_peer_id: "peer@im.wechat" },
    });
    expect(result.text).toContain("WeChat home channel");
    const cfg = readFileSync(join(home, "config.yaml"), "utf-8");
    expect(cfg).toContain("home_channel: peer@im.wechat");
  });

  it("/tooldisplay sets and resets conversation override", async () => {
    const sid = await testConv().newConversation("discord");
    const [cmd] = findCommand("/tooldisplay");
    const show = await executeCommand(cmd!, {
      conversationId: sid,
      platform: "discord",
      args: [],
      raw: "/tooldisplay",
    });
    expect(show.text).toContain("name");

    const set = await executeCommand(cmd!, {
      conversationId: sid,
      platform: "discord",
      args: ["hidden"],
      raw: "/tooldisplay hidden",
    });
    expect(set.text).toContain("hidden");

    const meta = await testConv().loadConversationMeta(sid);
    expect(isConversationMeta(meta) && meta.gateway_tool_display).toBe("hidden");

    const reset = await executeCommand(cmd!, {
      conversationId: sid,
      platform: "discord",
      args: ["reset"],
      raw: "/tooldisplay reset",
    });
    expect(reset.text).toContain("global default");
  });

  it("/restart resolves on chat, discord, and weixin", () => {
    for (const platform of [TEST_SAP_CHAT_PLATFORM, "discord", "weixin"] as const) {
      const [cmd] = resolveCommand("/restart", platform);
      expect(cmd?.name).toBe("restart");
    }
  });

  it("/restart returns restart action and hint text", async () => {
    const [cmd] = findCommand("/restart");
    expect(cmd?.name).toBe("restart");
    const result = await executeCommand(cmd!, {
      conversationId: "x",
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/restart",
    });
    expect(isRestartResult(result)).toBe(true);
    expect(result.text).toContain("Restarting service");
  });

  it("listCommands includes restart (chat / discord / weixin)", () => {
    const svc = getAppRuntime();
    for (const platform of [TEST_SAP_CHAT_PLATFORM, "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("restart");
    }
  });

  it("/restart returns already-restarting hint when shuttingDown", async () => {
    getAppRuntime().startShutdown();
    const [cmd] = findCommand("/restart");
    const result = await executeCommand(cmd!, {
      conversationId: "x",
      platform: TEST_SAP_CHAT_PLATFORM,
      args: [],
      raw: "/restart",
    });
    expect(result.text).toContain("already restarting");
    expect(isRestartResult(result)).toBe(false);
  });

  it("/upgrade resolves on chat, discord, and weixin", () => {
    for (const platform of [TEST_SAP_CHAT_PLATFORM, "discord", "weixin"] as const) {
      const [cmd] = resolveCommand("/upgrade", platform);
      expect(cmd?.name).toBe("upgrade");
    }
  });

  it("/upgrade returns upgrade action on npm install layout", async () => {
    const dir = createTempDir("freeanima-cli-npm-cmd-");
    const bunRoot = join(dir, "bun");
    const globalDir = join(bunRoot, "install/global");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "package.json"),
      JSON.stringify({
        name: "bun-global",
        dependencies: { "@freeanima/cli": "^0.4.0" },
      }),
    );
    const cliJs = join(dir, "node_modules", "@freeanima", "cli", "dist", "cli.js");
    mkdirSync(join(dir, "node_modules", "@freeanima", "cli", "dist"), { recursive: true });
    writeFileSync(cliJs, "// cli\n");
    const prevArgv1 = process.argv[1];
    const prevBunInstall = process.env.BUN_INSTALL;
    process.env.BUN_INSTALL = bunRoot;
    process.argv[1] = cliJs;
    try {
      const [cmd] = findCommand("/upgrade");
      const result = await executeCommand(cmd!, {
        conversationId: "x",
        platform: TEST_SAP_CHAT_PLATFORM,
        args: [],
        raw: "/upgrade",
      });
      expect(isUpgradeResult(result)).toBe(true);
      expect(result.text).toContain("正在从 npm 升级");
    } finally {
      process.argv[1] = prevArgv1;
      if (prevBunInstall === undefined) delete process.env.BUN_INSTALL;
      else process.env.BUN_INSTALL = prevBunInstall;
      removeTempDir(dir);
    }
  });

  it("/upgrade is disabled for local cli.ts installs", async () => {
    const dir = createTempDir("freeanima-cli-local-cmd-");
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    const prevArgv1 = process.argv[1];
    process.argv[1] = cliPath;
    try {
      const [cmd] = findCommand("/upgrade");
      const result = await executeCommand(cmd!, {
        conversationId: "x",
        platform: TEST_SAP_CHAT_PLATFORM,
        args: [],
        raw: "/upgrade",
      });
      expect(isUpgradeResult(result)).toBe(false);
      expect(result.text).toContain("源码 link 安装不支持自动 upgrade");
    } finally {
      process.argv[1] = prevArgv1;
      removeTempDir(dir);
    }
  });

  it("listCommands includes upgrade (chat / discord / weixin)", () => {
    const svc = getAppRuntime();
    for (const platform of [TEST_SAP_CHAT_PLATFORM, "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("upgrade");
    }
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
