import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
  syncIntegrationSelfLayer,
} from "../../helpers/integration-case.ts";
import type { PgTestContext } from "../../helpers/pg-test.ts";

import { isSessionMeta } from "@freeanima/core/db/domain";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
  isUpdateResult,
  resolveCommand,
} from "@freeanima/platform/commands";
import { getAppRuntime } from "@freeanima/platform";
import * as engineConversation from "@freeanima/runtime/conversation";

async function patchMetaForTest(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  await getTestEngine().repos.session.patchSessionMeta(sessionId, patch as never);
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
        sessionId: "x",
        platform: "parlor",
        args: [],
        raw: "/help",
      })
    ).text;
    expect(text).toContain("/retry");
    expect(text).toContain("/help");
    expect(text).toContain("Current session");
    expect(text).not.toContain("/new");
  });

  it("retry command returns retry action", async () => {
    const [cmd] = findCommand("/regenerate");
    expect(cmd?.name).toBe("retry");
    const result = await executeCommand(cmd!, {
      sessionId: "x",
      platform: "parlor",
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
        role: "session_meta",
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: "parlor",
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
    const parlor = svc.listCommands({ platform: "parlor" }).commands.map((c) => c.name);
    expect(parlor).toContain("help");
    expect(parlor).toContain("retry");
    expect(parlor).toContain("rebuild_session_cache");
    expect(parlor).not.toContain("reload_tools");
    expect(parlor).not.toContain("reload_system_prompt");
    expect(parlor).not.toContain("new");

    const discord = svc.listCommands({ platform: "discord" }).commands.map((c) => c.name);
    expect(discord).toContain("new");
    expect(discord).toContain("sethome");
  });

  it("resolveCommand blocks /new on parlor", async () => {
    expect(resolveCommand("/new", "parlor")[0]).toBeNull();
    expect(resolveCommand("/new", "discord")[0]?.name).toBe("new");
    expect(resolveCommand("/new", "weixin")[0]?.name).toBe("new");
  });

  it("/new creates session and returns new_session_id", async () => {
    const sid = await testConv().newSession("discord");
    const [cmd] = findCommand("/new");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "discord",
      args: [],
      raw: "/new",
    });
    expect(result.text).toContain("New session");
    const data = result.data as { new_session_id?: string } | undefined;
    expect(data?.new_session_id).toBeTruthy();
    expect(String(data?.new_session_id)).not.toBe(sid);
    expect(await testConv().sessionExists(String(data?.new_session_id))).toBe(true);
  });

  it("/new writes handoff summary as first assistant message without mutating old session", async () => {
    const handoffSpy = spyOn(engineConversation, "generateSessionHandoffSummary").mockResolvedValue(
      {
        ok: true,
        summary: "Previous conversation summary",
      },
    );

    try {
      const sid = "20260609_120000_handoff";
      await seedSession(
        getTestEngine(),
        sid,
        {
          role: "session_meta",
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
        sessionId: sid,
        platform: "discord",
        args: [],
        raw: "/new",
      });

      expect(handoffSpy).toHaveBeenCalled();
      expect(await testConv().countMessages(sid)).toBe(oldCount);

      const newSid = String((result.data as { new_session_id?: string })?.new_session_id);
      const msgs = await testConv().load(newSid);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]?.role).toBe("assistant");
      expect(msgs[0]?.content).toBe("Previous conversation summary");
    } finally {
      handoffSpy.mockRestore();
    }
  });

  it("rebuild_session_cache promotes staged toolsets and rebuilds system_prompt", async () => {
    const selfModel = "You are a test agent.";
    await syncIntegrationSelfLayer(pg, selfModel);

    const sid = await testConv().newSession("parlor");
    const metaBefore = await testConv().loadSessionMeta(sid);
    const preservedCwd = "/tmp/freeanima-preserved-cwd";
    await patchMetaForTest(sid, {
      cwd: preservedCwd,
      cached_toolsets: ["toolset", "memory"],
      staged_toolsets: ["file"],
      system_prompt: "old prompt",
      title: "preserved title",
    });

    const [cmd] = findCommand("/rebuild_session_cache");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/rebuild_session_cache",
    });
    expect(result.text).toContain("Rebuilt session cache");
    expect(result.text).toContain("cached_toolsets:");
    expect(result.text).toContain("promoted: file");

    const metaAfter = await testConv().loadSessionMeta(sid);
    expect(isSessionMeta(metaAfter)).toBe(true);
    if (!isSessionMeta(metaAfter)) return;
    expect(metaAfter.cached_toolsets).toContain("file");
    expect(metaAfter.staged_toolsets ?? []).toEqual([]);
    expect(metaAfter.cwd).toBe(preservedCwd);
    expect(metaAfter.title).toBe("preserved title");
    expect(metaAfter.model).toBe(metaBefore.model);

    const sp = String(metaAfter.system_prompt ?? "");
    expect(sp).toContain(selfModel);
    expect(sp).not.toBe("old prompt");
  });

  it("rebuild_session_cache on missing session returns warning", async () => {
    const [cmd] = findCommand("/rebuild-session-cache");
    const result = await executeCommand(cmd!, {
      sessionId: "nonexistent_session_abc",
      platform: "parlor",
      args: [],
      raw: "/rebuild_session_cache",
    });
    expect(result.text).toContain("does not exist");
  });

  it("rebuild_session_cache seeds default toolsets filtered by capability mask when cached is empty", async () => {
    const sid = await testConv().newSession("parlor");
    await patchMetaForTest(sid, {
      cached_toolsets: [],
      staged_toolsets: [],
    });
    await patchMetaForTest(sid, {
      capability_mask: { presets: ["sleep"] },
    });

    const [cmd] = findCommand("/rebuild_session_cache");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/rebuild_session_cache",
    });
    expect(result.text).toContain("Rebuilt session cache");

    const metaAfter = await testConv().loadSessionMeta(sid);
    expect(isSessionMeta(metaAfter)).toBe(true);
    if (!isSessionMeta(metaAfter)) return;
    expect(metaAfter.cached_toolsets).toContain("memory");
    expect(metaAfter.cached_toolsets).not.toContain("toolset");
    expect(metaAfter.cached_toolsets).not.toContain("session");
    expect(metaAfter.cached_toolsets).not.toContain("skill");
    expect(metaAfter.staged_toolsets ?? []).toEqual([]);
  });

  it("stats command reports session", async () => {
    const sid = await testConv().newSession("parlor");
    const [cmd] = findCommand("/stats");
    expect(cmd?.name).toBe("stats");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/stats",
    });
    expect(result.text).toContain("Session:");
  });

  it("title command get and set", async () => {
    const sid = await testConv().newSession("parlor");
    const [setCmd] = findCommand("/title");
    await executeCommand(setCmd!, {
      sessionId: sid,
      platform: "parlor",
      args: ["my title"],
      raw: "/title my title",
    });
    expect(await testConv().getSessionTitle(sid)).toBe("my title");
    const [getCmd] = findCommand("/title");
    const result = await executeCommand(getCmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/title",
    });
    expect(result.text).toContain("my title");
  });

  it("compress command reports compression state", async () => {
    const sid = await testConv().newSession("parlor");
    const [cmd] = findCommand("/compress");
    expect(cmd?.name).toBe("compress");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/compress",
    });
    expect(result.text).toContain("l3");
    expect(result.text).toContain("stored");
  });

  it("cwd command uses existing directory", async () => {
    const sid = await testConv().newSession("parlor");
    const [cmd] = findCommand("/cwd");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [home],
      raw: `/cwd ${home}`,
    });
    expect(result.text).toContain("Working directory switched");
    expect(await testConv().getSessionCwd(sid)).toBe(home);
  });

  it("/sethome writes discord home_channel to config", async () => {
    appendIntegrationConfig(home, "model: test\ndiscord:\n  require_mention: true\n");
    const [cmd] = findCommand("/sethome");
    expect(cmd?.name).toBe("sethome");
    const result = await executeCommand(cmd!, {
      sessionId: "x",
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
      sessionId: "x",
      platform: "weixin",
      args: [],
      raw: "/sethome",
      origin_extra: { weixin_peer_id: "peer@im.wechat" },
    });
    expect(result.text).toContain("WeChat home channel");
    const cfg = readFileSync(join(home, "config.yaml"), "utf-8");
    expect(cfg).toContain("home_channel: peer@im.wechat");
  });

  it("/restart resolves on parlor, discord, and weixin", () => {
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const [cmd] = resolveCommand("/restart", platform);
      expect(cmd?.name).toBe("restart");
    }
  });

  it("/restart returns restart action and hint text", async () => {
    const [cmd] = findCommand("/restart");
    expect(cmd?.name).toBe("restart");
    const result = await executeCommand(cmd!, {
      sessionId: "x",
      platform: "parlor",
      args: [],
      raw: "/restart",
    });
    expect(isRestartResult(result)).toBe(true);
    expect(result.text).toContain("Restarting service");
  });

  it("listCommands includes restart (parlor / discord / weixin)", () => {
    const svc = getAppRuntime();
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("restart");
    }
  });

  it("/restart returns already-restarting hint when shuttingDown", async () => {
    getAppRuntime().startShutdown();
    const [cmd] = findCommand("/restart");
    const result = await executeCommand(cmd!, {
      sessionId: "x",
      platform: "parlor",
      args: [],
      raw: "/restart",
    });
    expect(result.text).toContain("already restarting");
    expect(isRestartResult(result)).toBe(false);
  });

  it("/update resolves on parlor, discord, and weixin", () => {
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const [cmd] = resolveCommand("/update", platform);
      expect(cmd?.name).toBe("update");
    }
  });

  it("/update returns update action on npm install layout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-npm-cmd-"));
    const cliJs = join(dir, "node_modules", "@freeanima", "cli", "dist", "cli.js");
    mkdirSync(join(dir, "node_modules", "@freeanima", "cli", "dist"), { recursive: true });
    writeFileSync(cliJs, "// cli\n");
    const prevArgv1 = process.argv[1];
    process.argv[1] = cliJs;
    try {
      const [cmd] = findCommand("/update");
      const result = await executeCommand(cmd!, {
        sessionId: "x",
        platform: "parlor",
        args: [],
        raw: "/update",
      });
      expect(isUpdateResult(result)).toBe(true);
      expect(result.text).toContain("Updating");
    } finally {
      process.argv[1] = prevArgv1;
    }
  });

  it("/update is disabled for local cli.ts installs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-local-cmd-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    const prevArgv1 = process.argv[1];
    process.argv[1] = cliPath;
    try {
      const [cmd] = findCommand("/update");
      const result = await executeCommand(cmd!, {
        sessionId: "x",
        platform: "parlor",
        args: [],
        raw: "/update",
      });
      expect(isUpdateResult(result)).toBe(false);
      expect(result.text).toContain("disabled for local CLI");
    } finally {
      process.argv[1] = prevArgv1;
    }
  });

  it("listCommands includes update (parlor / discord / weixin)", () => {
    const svc = getAppRuntime();
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("update");
    }
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
