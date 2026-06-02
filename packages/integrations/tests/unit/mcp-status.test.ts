import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sanitizeMcpConfig, isMcpServerEnabled } from "../../src/mcp/status.js";
import { MCPManager } from "../../src/mcp/manager.js";

describe("sanitizeMcpConfig", () => {
  it("脱敏 env 值，仅保留键名", () => {
    const view = sanitizeMcpConfig({
      command: "node",
      args: ["server.mjs"],
      transport: "stdio",
      env: { SECRET: "hidden", OTHER: "x" },
      api_key_env: "MCP_TOKEN",
    });
    expect(view.command).toBe("node");
    expect(view.args).toEqual(["server.mjs"]);
    expect(view.api_key_env).toBe("MCP_TOKEN");
    expect(view.env_keys).toEqual(["SECRET", "OTHER"]);
    expect(view.enabled).toBe(true);
    expect(view).not.toHaveProperty("env");
  });

  it("enabled: false 时标记为禁用", () => {
    expect(isMcpServerEnabled({ enabled: false })).toBe(false);
    expect(sanitizeMcpConfig({ enabled: false, transport: "stdio" }).enabled).toBe(false);
  });
});

describe("MCPManager.getStatus", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-mcp-status-"));
    process.env.FREEANIMA_HOME = home;
    writeFileSync(
      join(home, "config.yaml"),
      [
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
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("未启动时返回配置与 not_started 状态", async () => {
    const mgr = new MCPManager();
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

  it("startAllAsync 立即返回且不阻塞 getStatus", async () => {
    const mgr = new MCPManager();
    mgr.startAllAsync();
    const status = await mgr.getStatus();
    expect(status.server_count).toBe(2);
    await mgr.closeAll();
  });
});
