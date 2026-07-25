import { afterEach, describe, expect, it, mock } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { CONFIG_MASKED_SECRET } from "@freeanima/host/platform/config";

import {
  bindOpsToolDeps,
  handleOpsConfigGet,
  handleOpsConfigPatch,
  handleOpsHealth,
  handleOpsRestart,
  handleOpsStatus,
  registerOpsTools,
  resetOpsToolDepsForTest,
} from "./ops-tools.ts";

afterEach(() => {
  resetOpsToolDepsForTest();
});

function parseResult(raw: string): Record<string, unknown> {
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("ops tools", () => {
  it("registerOpsTools registers ops toolset", () => {
    const toolSets = new ToolSetRegistry();
    registerOpsTools(toolSets);
    expect(toolSets.getToolSet("ops")).toBeDefined();
    expect(toolSets.getTool("ops_health")).toBeDefined();
    expect(toolSets.getTool("ops_restart")).toBeDefined();
  });

  it("ops_health returns runtime health", async () => {
    bindOpsToolDeps({
      getRuntime: () =>
        ({
          health: () => ({ status: "ok", version: "0.9.4" }),
        }) as never,
    });
    const out = parseResult(await handleOpsHealth());
    expect(out).toEqual({ status: "ok", version: "0.9.4" });
  });

  it("ops_status calls buildStatus with host/port", async () => {
    const buildStatus = mock(async () => ({ status: "running", pid: 1 }));
    bindOpsToolDeps({
      getRuntime: () =>
        ({
          host: "127.0.0.1",
          port: 2658,
          buildStatus,
        }) as never,
    });
    const out = parseResult(await handleOpsStatus());
    expect(buildStatus).toHaveBeenCalledWith("127.0.0.1", 2658);
    expect(out.status).toBe("running");
  });

  it("ops_config_get masks secrets", async () => {
    bindOpsToolDeps({
      getRuntime: () =>
        ({
          getConfig: () => ({
            config: {
              llm: {
                providers: { main: { api_key: "sk-secret", base_url: "https://x" } },
              },
            },
          }),
        }) as never,
    });
    const out = parseResult(await handleOpsConfigGet({}));
    const config = out.config as Record<string, unknown>;
    const llm = config.llm as Record<string, unknown>;
    const providers = llm.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe(CONFIG_MASKED_SECRET);
    expect(providers.main?.base_url).toBe("https://x");
  });

  it("ops_config_get rejects bootstrap section", async () => {
    bindOpsToolDeps({
      getRuntime: () =>
        ({
          getConfig: () => ({ config: {} }),
        }) as never,
    });
    const out = parseResult(await handleOpsConfigGet({ section: "database" }));
    expect(out.error).toMatch(/bootstrap/);
  });

  it("ops_config_patch requires confirm", async () => {
    const out = parseResult(
      await handleOpsConfigPatch({ section: "browser", patch: { timeout_ms: 1 } }),
    );
    expect(out.error).toMatch(/confirm=true/);
  });

  it("ops_config_patch rejects secret keys", async () => {
    const out = parseResult(
      await handleOpsConfigPatch({
        section: "llm",
        patch: { providers: { main: { api_key: "x" } } },
        confirm: true,
      }),
    );
    expect(out.error).toMatch(/forbidden/);
  });

  it("ops_config_patch rejects bootstrap section", async () => {
    const out = parseResult(
      await handleOpsConfigPatch({
        section: "database",
        patch: { url: "x" },
        confirm: true,
      }),
    );
    expect(out.error).toMatch(/bootstrap/);
  });

  it("ops_config_patch applies when confirmed", async () => {
    const patchSection = mock(async () => ({}));
    const data = { browser: { camofox: { timeout_ms: 1000 } } };
    bindOpsToolDeps({
      getRuntime: () =>
        ({
          engine: {
            config: {
              data,
              patchSection,
              replaceSection: mock(async () => ({})),
              reload: mock(async () => ({})),
            },
          },
        }) as never,
    });
    const out = parseResult(
      await handleOpsConfigPatch({
        section: "browser",
        patch: { camofox: { timeout_ms: 2000 } },
        confirm: true,
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.section).toBe("browser");
    expect(patchSection).toHaveBeenCalled();
  });

  it("ops_restart requires confirm", async () => {
    const scheduleRestart = mock(() => {});
    bindOpsToolDeps({ scheduleRestart });
    const out = parseResult(await handleOpsRestart({}));
    expect(out.error).toMatch(/confirm=true/);
    expect(scheduleRestart).not.toHaveBeenCalled();
  });

  it("ops_restart schedules when confirmed", async () => {
    const scheduleRestart = mock(() => {});
    bindOpsToolDeps({ scheduleRestart });
    const out = parseResult(await handleOpsRestart({ confirm: true }));
    expect(out).toEqual({ ok: true, code: "service_restarting" });
    expect(scheduleRestart).toHaveBeenCalled();
  });
});
