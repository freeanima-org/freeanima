import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";

import { clearConfigCache, registerTool, listTools } from "@freeanima/legacy-kernel";
import { registerAcpTools } from "@freeanima/legacy-integrations";

beforeEach(() => clearConfigCache());
afterEach(() => clearConfigCache());

describePg("acp manager", () => {
  it("registerAcpTools returns 0 when no agents configured", () => {
    const count = registerAcpTools({});
    expect(count).toBe(0);
  });

  it("registerAcpTools registers tools from config", () => {
    // 清理可能已有的 acp 工具计数基线
    const before = listTools().filter((t) => t.name.startsWith("acp_")).length;
    const count = registerAcpTools({
      test_agent: {
        command: "echo",
        args: [],
        description: "测试 agent",
      },
    });
    expect(count).toBe(1);
    const names = listTools().map((t) => t.name);
    expect(names).toContain("acp_test_agent");
    expect(names.length).toBeGreaterThanOrEqual(before + 1);
    void registerTool;
  });
});
