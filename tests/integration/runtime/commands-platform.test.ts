import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import { appendIntegrationConfig, testConv } from "../../helpers/pg-test.ts";
import {
  findCommand,
  executeCommand,
  isRestartResult,
  isUpgradeResult,
  resolveCommand,
} from "@freeanima/habitat/capabilities/tools/slash-commands";
import { getAppRuntime } from "@freeanima/habitat/platform";
import { getHomeChannel } from "@freeanima/habitat/platform/ports/home-channel";
import { getHabitatRuntimeConfigDocument } from "@freeanima/habitat/core/db/pg";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

describePg("slash commands (platform)", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-cmd-plat-");
    home = ctx.home;
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("/sethome writes discord home_channel to runtime config", async () => {
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
    expect(getHomeChannel("discord")).toEqual({
      chat_id: "1234567890123456789",
      thread_id: "999",
    });
    const doc = await getHabitatRuntimeConfigDocument();
    const discord = doc.discord as Record<string, unknown> | undefined;
    expect(discord?.home_channel).toBe("1234567890123456789");
    expect(discord?.home_thread_id).toBe("999");
  });

  it("/sethome writes weixin home_channel to runtime config", async () => {
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
    expect(getHomeChannel("weixin")).toEqual({ chat_id: "peer@im.wechat" });
    const doc = await getHabitatRuntimeConfigDocument();
    const weixin = doc.weixin as Record<string, unknown> | undefined;
    expect(weixin?.home_channel).toBe("peer@im.wechat");
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

  it("/upgrade is disabled for source installs", async () => {
    const dir = createTempDir("freeanima-cli-local-cmd-");
    const cliPath = join(dir, "src", "app", "cli", "cli.ts");
    mkdirSync(join(dir, "src", "app", "cli"), { recursive: true });
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
      expect(result.text).toContain("源码安装不支持自动 upgrade");
    } finally {
      if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
      else delete (process.argv as { 1?: string })[1];
      removeTempDir(dir);
    }
  });

  it("/upgrade hints terminal upgrade for standalone installs", async () => {
    const prevArgv1 = process.argv[1];
    process.argv[1] = "/$bunfs/root/anima";
    try {
      const [cmd] = findCommand("/upgrade");
      const result = await executeCommand(cmd!, {
        conversationId: "x",
        platform: TEST_SAP_CHAT_PLATFORM,
        args: [],
        raw: "/upgrade",
      });
      expect(isUpgradeResult(result)).toBe(false);
      expect(result.text).toContain("anima upgrade");
      expect(result.text).toContain("anima service restart");
    } finally {
      if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
      else delete (process.argv as { 1?: string })[1];
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
