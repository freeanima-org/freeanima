import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/core/config";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/platform/config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { sanitizeAcpConfig, shortSessionId, isAcpAgentEnabled } from "./status.ts";
import { createTestAcpManager } from "./test-helpers/manager.ts";

function acpConfigYaml(extra: string): ReturnType<typeof parseMinimal> {
  return parseMinimal([MINIMAL_LLM_YAML.trim(), extra].join("\n"));
}

function parseMinimal(yaml: string) {
  const parsed = animaConfigSchema.safeParse(parseYaml(yaml));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("isAcpAgentEnabled", () => {
  it("enabled when omitted or true", () => {
    expect(isAcpAgentEnabled({})).toBe(true);
    expect(isAcpAgentEnabled({ enabled: true })).toBe(true);
    expect(isAcpAgentEnabled({ enabled: false })).toBe(false);
  });
});

describe("sanitizeAcpConfig", () => {
  it("exports display fields", () => {
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
  it("truncates long IDs", () => {
    const id = "a".repeat(40);
    expect(shortSessionId(id)).toMatch(/…$/);
    expect(shortSessionId("short")).toBe("short");
  });
});

describe("AcpManager.getStatus", () => {
  it("returns config and not_started when not connected", () => {
    const config = Config.fromSnapshot(
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
    const { mgr } = createTestAcpManager(config);
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

  it("startAll aggregates failures", async () => {
    const config = Config.fromSnapshot(
      acpConfigYaml(
        ["acp_agents:", "  cursor:", "    command: echo", "    args: [noop]"].join("\n"),
      ),
    );
    const { mgr } = createTestAcpManager(config);
    const result = await mgr.startAll();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cursor:/);
  });

  it("disabled agent shows disabled status", async () => {
    const config = Config.fromSnapshot(
      acpConfigYaml(
        ["acp_agents:", "  cursor:", "    command: echo", "    enabled: false"].join("\n"),
      ),
    );
    const { mgr } = createTestAcpManager(config);
    mgr.registerTools();
    const status = mgr.getStatus();
    expect(status.agents[0]?.status).toBe("disabled");
  });
});
