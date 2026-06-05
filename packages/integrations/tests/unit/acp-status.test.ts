import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearConfigCache } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "../../../../tests/helpers/minimal-llm-config.ts";
import { sanitizeAcpConfig, shortSessionId, isAcpAgentEnabled } from "../../src/acp/status.ts";
import { AcpManager } from "../../src/acp/manager.ts";

describe("isAcpAgentEnabled", () => {
  it("缺省或为 true 时启用", () => {
    expect(isAcpAgentEnabled({})).toBe(true);
    expect(isAcpAgentEnabled({ enabled: true })).toBe(true);
    expect(isAcpAgentEnabled({ enabled: false })).toBe(false);
  });
});

describe("sanitizeAcpConfig", () => {
  it("导出展示用字段", () => {
    const view = sanitizeAcpConfig({
      command: "/usr/bin/agent",
      args: ["--force", "acp"],
      cwd: "/tmp/proj",
      description: "Cursor",
      plan_mode: false,
      agent_mode: "agent",
      connect_timeout_ms: 15000,
      prompt_timeout_ms: 120000,
    });
    expect(view.command).toBe("/usr/bin/agent");
    expect(view.args).toEqual(["--force", "acp"]);
    expect(view.plan_mode).toBe(false);
    expect(view.agent_mode).toBe("agent");
    expect(view.enabled).toBe(true);
    expect(view.connect_timeout_ms).toBe(15000);
    expect(view.prompt_timeout_ms).toBe(120000);
  });
});

describe("shortSessionId", () => {
  it("长 ID 截断", () => {
    const id = "a".repeat(40);
    expect(shortSessionId(id)).toMatch(/…$/);
    expect(shortSessionId("short")).toBe("short");
  });
});

describe("AcpManager.getStatus", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    clearConfigCache();
    home = mkdtempSync(join(tmpdir(), "freeanima-acp-status-"));
    process.env.FREEANIMA_HOME = home;
    writeFileSync(
      join(home, "config.yaml"),
      [
        MINIMAL_LLM_YAML.trim(),
        "acp_agents:",
        "  cursor:",
        "    command: echo",
        "    args: [noop]",
        "    description: test agent",
        "    plan_mode: false",
      ].join("\n"),
    );
  });

  afterEach(() => {
    clearConfigCache();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("未连接时返回配置与 not_started 状态", () => {
    const mgr = new AcpManager();
    mgr.registerTools();
    const status = mgr.getStatus();

    expect(status.agent_count).toBe(1);
    expect(status.connected_count).toBe(0);
    expect(status.agents[0]?.name).toBe("cursor");
    expect(status.agents[0]?.status).toBe("not_started");
    expect(status.agents[0]?.config.command).toBe("echo");
    expect(status.agents[0]?.config.enabled).toBe(true);
    expect(status.agents[0]?.tool?.name).toBe("acp_cursor");
  });

  it("startAll 聚合失败", async () => {
    const mgr = new AcpManager();
    const result = await mgr.startAll();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cursor:/);
  });

  it("disabled agent 显示 disabled 状态", async () => {
    writeFileSync(
      join(home, "config.yaml"),
      [
        MINIMAL_LLM_YAML.trim(),
        "acp_agents:",
        "  cursor:",
        "    command: echo",
        "    enabled: false",
      ].join("\n"),
    );
    clearConfigCache();
    const mgr = new AcpManager();
    const status = mgr.getStatus();
    expect(status.agents[0]?.status).toBe("disabled");
  });
});
