import { describe, it, expect, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { resetConfigForTest, setConfigForTest } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { sanitizeAcpConfig, shortSessionId, isAcpAgentEnabled } from "./status.ts";
import { AcpManager } from "./manager.ts";

function acpConfigYaml(extra: string): ReturnType<typeof parseMinimal> {
  return parseMinimal([MINIMAL_LLM_YAML.trim(), extra].join("\n"));
}

function parseMinimal(yaml: string) {
  const parsed = animaConfigSchema.safeParse(parseYaml(yaml));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

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
  afterEach(() => {
    resetConfigForTest();
  });

  it("未连接时返回配置与 not_started 状态", () => {
    setConfigForTest(
      acpConfigYaml(
        [
          "acp_agents:",
          "  cursor:",
          "    command: echo",
          "    args: [noop]",
          "    description: test agent",
          "    plan_mode: false",
        ].join("\n"),
      ),
    );
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
    setConfigForTest(
      acpConfigYaml(
        ["acp_agents:", "  cursor:", "    command: echo", "    args: [noop]"].join("\n"),
      ),
    );
    const mgr = new AcpManager();
    const result = await mgr.startAll();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cursor:/);
  });

  it("disabled agent 显示 disabled 状态", async () => {
    setConfigForTest(
      acpConfigYaml(
        ["acp_agents:", "  cursor:", "    command: echo", "    enabled: false"].join("\n"),
      ),
    );
    const mgr = new AcpManager();
    const status = mgr.getStatus();
    expect(status.agents[0]?.status).toBe("disabled");
  });
});
