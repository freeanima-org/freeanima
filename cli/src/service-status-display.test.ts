import { describe, expect, it } from "bun:test";

import { printServiceRunningStatus } from "./output/service-status-display.ts";

describe("printServiceRunningStatus", () => {
  it("renders grouped sections with aligned fields", () => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      printServiceRunningStatus({
        body: {
          pid: 42,
          version: "0.4.0",
          uptime_seconds: 90,
          config: { model: "deepseek-v4-pro", api_base: "https://example/v1" },
          platforms: {
            discord: { status: "connected", bot_name: "bot#1" },
            weixin: { status: "connected" },
          },
          sessions: { total: 10 },
          tools: 64,
          cron_jobs: 3,
          memory_kb: 512000,
          memory_detail: {
            heap_used_kb: 280000,
            external_kb: 32000,
            tokenizer_repos: ["BAAI/bge-m3", "deepseek-ai/deepseek-v4-pro"],
            jieba_loaded: false,
            mcp: { server_count: 0, connected_count: 0 },
            acp: { agent_count: 1, connected_count: 1 },
          },
        },
        statusFile: {},
        host: "127.0.0.1",
        port: 2658,
        healthMs: 12,
        systemd: "active",
        pidOverride: 42,
      });
    } finally {
      console.log = log;
    }

    const text = lines.join("\n");
    expect(text).toContain("Free Anima · running · health 12ms");
    expect(text).toContain("runtime");
    expect(text).toContain("http        http://127.0.0.1:2658");
    expect(text).toContain("webui       http://127.0.0.1:2658/webui");
    expect(text).toContain("llm");
    expect(text).toContain("gateways (2)");
    expect(text).toContain("discord     connected · bot#1");
    expect(text).toContain("workload");
    expect(text).toContain("10 sessions · 64 tools · 3 cron");
    expect(text).toContain("memory");
    expect(text).toContain("tokenizers  2 loaded (bge-m3, deepseek-v4-pro)");
    expect(text).toContain("connectors  ACP 1/1");
  });
});
