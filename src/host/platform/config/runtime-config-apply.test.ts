import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

import { Config } from "@freeanima/host/core/config";
import {
  applyRuntimeConfigSection,
  resetRuntimeConfigApplyDepsForTest,
  TRANSFERRED_RUNTIME_SECTIONS,
} from "./runtime-config-apply.ts";

describe("applyRuntimeConfigSection", () => {
  beforeEach(() => {
    resetRuntimeConfigApplyDepsForTest();
  });

  afterEach(() => {
    resetRuntimeConfigApplyDepsForTest();
  });

  it("live 段为 no-op（不抛错）", async () => {
    const config = Config.fromSnapshot({ compression: { enabled: true } });
    await applyRuntimeConfigSection(config, "compression");
    await applyRuntimeConfigSection(config, "memory");
    expect(config.data.compression?.enabled).toBe(true);
  });

  it("TRANSFERRED_RUNTIME_SECTIONS 含 llm / mcp / worlds", () => {
    expect(TRANSFERRED_RUNTIME_SECTIONS).toContain("llm");
    expect(TRANSFERRED_RUNTIME_SECTIONS).toContain("mcp_servers");
    expect(TRANSFERRED_RUNTIME_SECTIONS).toContain("worlds");
  });

  it("i18n apply 不依赖 runtime context", async () => {
    const config = Config.fromSnapshot({
      i18n: { locale: "zh-cn", timezone: "Asia/Shanghai" },
    });
    await applyRuntimeConfigSection(config, "i18n");
  });

  it("mcp apply 在无 manager 时跳过（不抛错）", async () => {
    const config = Config.fromSnapshot({ mcp_servers: {} });
    await applyRuntimeConfigSection(config, "mcp_servers");
  });

  it("mcp apply 在绑定 deps 时调用 stopAll + startAllEnabled", async () => {
    const stopAll = mock(async () => ({ ok: true as const, action: "stop" as const }));
    const startAllEnabled = mock(async () => ({ ok: true as const, action: "start" as const }));
    const { bindRuntimeConfigApplyDeps } = await import("./runtime-config-apply.ts");
    bindRuntimeConfigApplyDeps({
      getMcp: () => ({
        stopAll,
        startAllEnabled,
        getToolCount: () => 0,
        getConnectionSummary: () => ({
          server_count: 0,
          connected_count: 0,
          connecting_count: 0,
        }),
        getStatus: () => ({
          server_count: 0,
          connected_count: 0,
          connecting_count: 0,
          tool_count: 0,
          servers: [],
        }),
        startServer: async () => ({ ok: true }),
        stopServer: async () => ({ ok: true }),
      }),
    });
    const config = Config.fromSnapshot({ mcp_servers: {} });
    await applyRuntimeConfigSection(config, "mcp_servers");
    expect(stopAll).toHaveBeenCalled();
    expect(startAllEnabled).toHaveBeenCalled();
  });
});
