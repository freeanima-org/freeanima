import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { getAppRuntime, readAppVersion } from "@freeanima/platform";

const ROOT_VERSION = readAppVersion();

describePg("server status API", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-status-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("buildStatus matches Habitat / bedroom contract", async () => {
    const svc = getAppRuntime();
    svc.markStarted();
    const body = await svc.buildStatus("127.0.0.1", 8080);

    expect(body.status).toBe("running");
    expect(body.version).toBe(ROOT_VERSION);
    expect(typeof body.tools).toBe("number");
    expect(typeof body.cron_jobs).toBe("number");
    expect(body.extensions).toEqual(
      expect.objectContaining({
        commands: expect.any(Number),
        mcp: expect.objectContaining({
          server_count: expect.any(Number),
          connected_count: expect.any(Number),
          connecting_count: expect.any(Number),
          tool_count: expect.any(Number),
        }),
        acp: expect.objectContaining({
          agent_count: expect.any(Number),
          connected_count: expect.any(Number),
          session_count: expect.any(Number),
          tool_count: expect.any(Number),
        }),
      }),
    );
    expect(body.uptime_seconds).not.toBeNull();
    expect(body.conversations).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        by_platform: expect.any(Object),
      }),
    );
    expect(body.memory).toEqual(
      expect.objectContaining({
        files_count: expect.any(Number),
        files_bytes: expect.any(Number),
        semantic_memory_count: expect.any(Number),
        dialogue_message_count: expect.any(Number),
      }),
    );
    expect(body.platforms).toBeTypeOf("object");
    expect(body.dependencies).toEqual(
      expect.objectContaining({
        postgres: expect.objectContaining({
          status: expect.stringMatching(/^(connected|error|not_configured)$/),
        }),
        redis: expect.objectContaining({
          status: expect.stringMatching(/^(connected|error|not_configured)$/),
        }),
      }),
    );
    expect(body.dependencies.postgres.status).toBe("connected");
    expect(body.memory_detail).toEqual(
      expect.objectContaining({
        rss_kb: expect.any(Number),
        vm_size_kb: expect.any(Number),
        heap_used_kb: expect.any(Number),
        heap_total_kb: expect.any(Number),
        external_kb: expect.any(Number),
        array_buffers_kb: expect.any(Number),
        tokenizer_repos: expect.any(Array),
        tokenizer_bindings: expect.any(Array),
        jieba_loaded: expect.any(Boolean),
        mcp: expect.objectContaining({
          server_count: expect.any(Number),
          connected_count: expect.any(Number),
          connecting_count: expect.any(Number),
        }),
        acp: expect.objectContaining({
          agent_count: expect.any(Number),
          connected_count: expect.any(Number),
        }),
      }),
    );
  });

  it("health returns status ok", () => {
    expect(getAppRuntime().health()).toEqual(
      expect.objectContaining({
        status: "ok",
        version: ROOT_VERSION,
      }),
    );
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
