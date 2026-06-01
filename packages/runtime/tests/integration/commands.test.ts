import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function patchMetaForTest(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { patchSessionMeta } = await import("@freeanima/db");
  await patchSessionMeta(sessionId, patch as never);
}

describePg("slash commands", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-cmd-");
    home = ctx.home;
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("help lists retry and help", async () => {
    const { findCommand, executeCommand } = await import("@freeanima/core");
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
    expect(text).toContain("当前 session");
    expect(text).not.toContain("/new");
  });

  it("retry command returns retry action", async () => {
    const { findCommand, executeCommand, isRetryResult } = await import("@freeanima/core");
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
    const { rollbackToLastUser, load } = await import("@freeanima/core");
    const { seedSession } = await import("@freeanima/db/test-helpers");
    const sid = "20260526_160000_retry";
    await seedSession(
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
        { role: "user", content: "你好", id: 1, timestamp: "t1" },
        { role: "assistant", content: "旧回复", id: 2, timestamp: "t2" },
      ],
    );

    const content = await rollbackToLastUser(sid);
    expect(content).toBe("你好");
    const msgs = await load(sid);
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(0);
    expect(msgs.filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("listCommands includes help and retry", async () => {
    const { NestService } = await import("@freeanima/core");
    const parlor = new NestService().listCommands({ platform: "parlor" }).commands.map((c) => c.name);
    expect(parlor).toContain("help");
    expect(parlor).toContain("retry");
    expect(parlor).toContain("reload_tools");
    expect(parlor).not.toContain("new");

    const discord = new NestService().listCommands({ platform: "discord" }).commands.map((c) => c.name);
    expect(discord).toContain("new");
    expect(discord).toContain("sethome");
  });

  it("resolveCommand blocks /new on parlor", async () => {
    const { resolveCommand } = await import("@freeanima/core");
    expect(resolveCommand("/new", "parlor")[0]).toBeNull();
    expect(resolveCommand("/new", "discord")[0]?.name).toBe("new");
    expect(resolveCommand("/new", "weixin")[0]?.name).toBe("new");
  });

  it("/new creates session and returns new_session_id", async () => {
    const { findCommand, executeCommand, newSession, sessionExists } = await import("@freeanima/core");
    const sid = await newSession("discord");
    const [cmd] = findCommand("/new");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "discord",
      args: [],
      raw: "/new",
    });
    expect(result.text).toContain("新 session");
    expect(result.data?.new_session_id).toBeTruthy();
    expect(String(result.data?.new_session_id)).not.toBe(sid);
    expect(await sessionExists(String(result.data?.new_session_id))).toBe(true);
  });

  it("reload_tools updates session_meta tools", async () => {
    const { findCommand, executeCommand, newSession, loadSessionMeta, loadSessionTools, registerTool } =
      await import("@freeanima/core");
    const sid = await newSession("parlor");
    await patchMetaForTest(sid, {
      tools: [{ type: "function", function: { name: "stale_tool", parameters: { type: "object" } } }],
    });

    registerTool({
      name: "reload_tools_test_only",
      description: "test",
      parameters: { type: "object", properties: {} },
      handler: async () => JSON.stringify({ ok: true }),
    });

    const [cmd] = findCommand("/reload_tools");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_tools",
    });
    expect(result.text).toContain("已更新 session 工具列表");

    const metaTools = await loadSessionMeta(sid);
    const tools = await loadSessionTools(sid, metaTools);
    const names = tools.map((t) => t.function?.name).filter(Boolean);
    expect(names).toContain("reload_tools_test_only");
    expect(names).not.toContain("stale_tool");
  });

  it("reload_tools on missing session returns warning", async () => {
    const { findCommand, executeCommand } = await import("@freeanima/core");
    const [cmd] = findCommand("/reload-tools");
    const result = await executeCommand(cmd!, {
      sessionId: "nonexistent_session_abc",
      platform: "parlor",
      args: [],
      raw: "/reload_tools",
    });
    expect(result.text).toContain("不存在");
  });

  it("reload_system_prompt rebuilds session meta", async () => {
    const { findCommand, executeCommand, newSession, loadSessionMeta, loadSessionTools } =
      await import("@freeanima/core");
    writeFileSync(join(home, "SOUL.md"), "你是测试 Agent。\n", "utf-8");
    const sid = await newSession("parlor");
    await patchMetaForTest(sid, { system_prompt: "旧 prompt" });

    const [cmd] = findCommand("/reload_system_prompt");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_system_prompt",
    });
    expect(result.text).toContain("system prompt");
    const spMeta = await loadSessionMeta(sid);
    const sp = String(spMeta.role === "session_meta" ? spMeta.system_prompt ?? "" : "");
    expect(sp).toContain("你是测试 Agent");
    expect(sp).not.toBe("旧 prompt");
  });

  it("reload_system_prompt only updates system_prompt", async () => {
    const { findCommand, executeCommand, newSession, loadSessionMeta, loadSessionTools } =
      await import("@freeanima/core");
    writeFileSync(join(home, "SOUL.md"), "你是测试 Agent。\n", "utf-8");
    const sid = await newSession("parlor");
    const metaBefore = await loadSessionMeta(sid);
    const preservedCwd = "/tmp/freeanima-preserved-cwd";
    const preservedTools = [{ type: "function", function: { name: "keep_tool" } }];
    await patchMetaForTest(sid, {
      cwd: preservedCwd,
      tools: preservedTools,
      system_prompt: "旧 prompt",
      title: "保留标题",
    });

    const [cmd] = findCommand("/reload_system_prompt");
    await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/reload_system_prompt",
    });

    const metaAfter = await loadSessionMeta(sid);
    expect(metaAfter.cwd).toBe(preservedCwd);
    expect(await loadSessionTools(sid, metaAfter)).toEqual(preservedTools);
    expect(metaAfter.title).toBe("保留标题");
    expect(metaAfter.model).toBe(metaBefore.model);
    expect(String(metaAfter.system_prompt ?? "")).not.toBe("旧 prompt");
  });

  it("stats command reports session", async () => {
    const { findCommand, executeCommand, newSession } = await import("@freeanima/core");
    const sid = await newSession("parlor");
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
    const { findCommand, executeCommand, newSession, getSessionTitle } = await import(
      "@freeanima/core"
    );
    const sid = await newSession("parlor");
    const [setCmd] = findCommand("/title");
    await executeCommand(setCmd!, {
      sessionId: sid,
      platform: "parlor",
      args: ["我的标题"],
      raw: "/title 我的标题",
    });
    expect(await getSessionTitle(sid)).toBe("我的标题");
    const [getCmd] = findCommand("/title");
    const result = await executeCommand(getCmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/title",
    });
    expect(result.text).toContain("我的标题");
  });

  it("compress command reports compression state", async () => {
    const { findCommand, executeCommand, newSession } = await import("@freeanima/core");
    const sid = await newSession("parlor");
    const [cmd] = findCommand("/compress");
    expect(cmd?.name).toBe("compress");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [],
      raw: "/compress",
    });
    expect(result.text).toContain("l3");
    expect(result.text).toContain("JSONL");
  });

  it("cwd command uses existing directory", async () => {
    const { findCommand, executeCommand, newSession, getSessionCwd } = await import(
      "@freeanima/core"
    );
    const sid = await newSession("parlor");
    const [cmd] = findCommand("/cwd");
    const result = await executeCommand(cmd!, {
      sessionId: sid,
      platform: "parlor",
      args: [home],
      raw: `/cwd ${home}`,
    });
    expect(result.text).toContain("工作目录已切换");
    expect(await getSessionCwd(sid)).toBe(home);
  });

  it("/sethome writes discord home_channel to config", async () => {
    const { findCommand, executeCommand } = await import("@freeanima/core");
    const { appendIntegrationConfig } = await import("@freeanima/db/test-helpers");
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
    const { findCommand, executeCommand } = await import("@freeanima/core");
    const { appendIntegrationConfig } = await import("@freeanima/db/test-helpers");
    appendIntegrationConfig(home, "model: test\n");
    const [cmd] = findCommand("/sethome");
    const result = await executeCommand(cmd!, {
      sessionId: "x",
      platform: "weixin",
      args: [],
      raw: "/sethome",
      origin_extra: { weixin_peer_id: "peer@im.wechat" },
    });
    expect(result.text).toContain("微信 home channel");
    const cfg = readFileSync(join(home, "config.yaml"), "utf-8");
    expect(cfg).toContain("home_channel: peer@im.wechat");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});