import { it, expect, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
  syncIntegrationSelfLayer,
} from "../../helpers/integration-case.ts";
import type { PgTestContext } from "../../helpers/pg-test.ts";
import {
  SELF_BLOCK_HEADINGS,
  SELF_LAYER_PROMPT_HEADING,
  SELF_LAYER_SYSTEM_FRAME,
} from "@freeanima/capabilities-identity";

import { isSessionMeta } from "@freeanima/storage-db/domain";
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
} from "@freeanima/service-commands";
import { getServiceContext } from "@freeanima/service";
import * as engineConversation from "@freeanima/orchestration-conversation";

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
        tools: [],
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
    const svc = getServiceContext().service;
    const parlor = svc.listCommands({ platform: "parlor" }).commands.map((c) => c.name);
    expect(parlor).toContain("help");
    expect(parlor).toContain("retry");
    expect(parlor).toContain("reload_tools");
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
          tools: [],
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

  it("reload_tools resets session to default tools", async () => {
    const sid = await testConv().newSession("parlor");
    await patchMetaForTest(sid, {
      tools: ["stale_tool"],
      loaded_tools: ["file_read_file"],
    });

    const [cmd] = findCommand("/reload_tools");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_tools",
    });
    expect(result.text).toContain("Reset session tools");

    const meta = await testConv().loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;
    expect(meta.tools).not.toContain("stale_tool");
    expect(meta.loaded_tools ?? []).toEqual([]);
    const schemas = await testConv().loadSessionTools(sid, meta);
    const names = schemas.map((t) => t.function?.name).filter(Boolean);
    expect(names).toContain("tools_list");
    expect(names).toContain("tools_load");
  });

  it("reload_tools on missing session returns warning", async () => {
    const [cmd] = findCommand("/reload-tools");
    const result = await executeCommand(cmd!, {
      sessionId: "nonexistent_session_abc",
      platform: "parlor",
      args: [],
      raw: "/reload_tools",
    });
    expect(result.text).toContain("does not exist");
  });

  it("reload_system_prompt rebuilds session meta", async () => {
    const selfModel = "You are a test agent.";
    await syncIntegrationSelfLayer(pg, selfModel);

    const sid = await testConv().newSession("parlor");
    await patchMetaForTest(sid, { system_prompt: "old prompt" });

    const [cmd] = findCommand("/reload_system_prompt");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_system_prompt",
    });
    expect(result.text).toContain("system prompt");
    const spMeta = await testConv().loadSessionMeta(sid);
    const sp = String(spMeta.role === "session_meta" ? (spMeta.system_prompt ?? "") : "");
    expect(sp).toContain(SELF_LAYER_SYSTEM_FRAME);
    expect(sp).toContain(`## ${SELF_LAYER_PROMPT_HEADING}`);
    expect(sp).toContain("```md");
    for (const heading of Object.values(SELF_BLOCK_HEADINGS)) {
      expect(sp).toContain(`## ${heading}`);
    }
    expect(sp).toContain(selfModel);
    expect(sp).not.toBe("old prompt");
  });

  it("reload_system_prompt only updates system_prompt", async () => {
    const selfModel = "You are a test agent.";
    await syncIntegrationSelfLayer(pg, selfModel);
    const sid = await testConv().newSession("parlor");
    const metaBefore = await testConv().loadSessionMeta(sid);
    const preservedCwd = "/tmp/freeanima-preserved-cwd";
    const preservedTools = ["keep_tool"];
    await patchMetaForTest(sid, {
      cwd: preservedCwd,
      tools: preservedTools,
      system_prompt: "old prompt",
      title: "preserved title",
    });

    const [cmd] = findCommand("/reload_system_prompt");
    await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_system_prompt",
    });

    const metaAfter = await testConv().loadSessionMeta(sid);
    expect(metaAfter.cwd).toBe(preservedCwd);
    expect(await getTestEngine().repos.session.getSessionTools(sid)).toEqual(preservedTools);
    expect(metaAfter.title).toBe("preserved title");
    expect(metaAfter.model).toBe(metaBefore.model);
    expect(String(metaAfter.system_prompt ?? "")).not.toBe("old prompt");
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
    const svc = getServiceContext().service;
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("restart");
    }
  });

  it("/restart returns already-restarting hint when shuttingDown", async () => {
    getServiceContext().service.startShutdown();
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
    const svc = getServiceContext().service;
    for (const platform of ["parlor", "discord", "weixin"] as const) {
      const names = svc.listCommands({ platform }).commands.map((c) => c.name);
      expect(names).toContain("update");
    }
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
