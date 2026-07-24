import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/host/platform/config";
import { parseYaml } from "@freeanima/host/platform/config";
import { animaConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import { sanitizeMcpConfig, isMcpServerEnabled } from "./status.ts";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { MCPManager } from "./manager.ts";

function mcpTestConfig() {
  const raw = parseYaml(
    [
      MINIMAL_LLM_YAML.trim(),
      "mcp_servers:",
      "  db:",
      "    command: echo",
      "    args: [noop]",
      "    transport: stdio",
      "  remote:",
      "    url: http://127.0.0.1:9999/mcp",
      "    transport: sse",
      "    api_key_env: MCP_API_KEY",
      "    enabled: false",
    ].join("\n"),
  );
  const parsed = animaConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

describe("sanitizeMcpConfig", () => {
  it("keeps env and headers values for round-trip editing", () => {
    const view = sanitizeMcpConfig({
      command: "node",
      args: ["server.mjs"],
      transport: "stdio",
      env: { SECRET: "hidden", OTHER: "x" },
      api_key_env: "MCP_TOKEN",
      headers: { "X-Custom": "1" },
    });
    expect(view.command).toBe("node");
    expect(view.args).toEqual(["server.mjs"]);
    expect(view.api_key_env).toBe("MCP_TOKEN");
    expect(view.env).toEqual({ SECRET: "hidden", OTHER: "x" });
    expect(view.headers).toEqual({ "X-Custom": "1" });
    expect(view.enabled).toBe(true);
    expect(view).not.toHaveProperty("env_keys");
  });

  it("marked disabled when enabled: false", () => {
    expect(isMcpServerEnabled({ enabled: false })).toBe(false);
    expect(sanitizeMcpConfig({ enabled: false, transport: "stdio" }).enabled).toBe(false);
  });
});

describe("MCPManager.getStatus", () => {
  it("returns config and not_started when not started", async () => {
    const mgr = new MCPManager(new ToolSetRegistry(), mcpTestConfig());
    const status = await mgr.getStatus();

    expect(status.server_count).toBe(2);
    expect(status.connected_count).toBe(0);
    expect(status.connecting_count).toBe(0);
    expect(status.servers.map((s) => s.name)).toEqual(["db", "remote"]);

    const db = status.servers.find((s) => s.name === "db")!;
    expect(db.status).toBe("not_started");
    expect(db.config.command).toBe("echo");
    expect(db.tools).toEqual([]);

    const remote = status.servers.find((s) => s.name === "remote")!;
    expect(remote.config.url).toBe("http://127.0.0.1:9999/mcp");
    expect(remote.config.transport).toBe("sse");
    expect(remote.config.enabled).toBe(false);
    expect(remote.status).toBe("disabled");
  });

  it("startAllAsync returns immediately without blocking getStatus", async () => {
    const mgr = new MCPManager(new ToolSetRegistry(), mcpTestConfig());
    mgr.startAllAsync();
    const status = await mgr.getStatus();
    expect(status.server_count).toBe(2);
    await mgr.closeAll();
  });

  it("does not keep deleted servers as status ghosts after config update", async () => {
    const config = mcpTestConfig();
    const mgr = new MCPManager(new ToolSetRegistry(), config);
    // 填充内存缓存（与启动路径一致）
    await mgr.startAllEnabled();

    const next = structuredClone(config.data);
    delete next.mcp_servers!.remote;
    config.update(next);

    const status = await mgr.getStatus();
    expect(status.server_count).toBe(1);
    expect(status.servers.map((s) => s.name)).toEqual(["db"]);
    expect(mgr.getConnectionSummary().server_count).toBe(1);

    await mgr.closeAll();
  });
});
