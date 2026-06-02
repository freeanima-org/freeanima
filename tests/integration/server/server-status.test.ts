import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.js";
import { beginIntegrationCase } from "../../helpers/integration-case.js";
import { endIntegrationCase } from "../../helpers/integration-case.js";

import { NestService, readRootVersion } from "@freeanima/legacy-runtime";

const ROOT_VERSION = readRootVersion();

describePg("server status API", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-status-");
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("buildStatus matches WebUI / 卧室 contract", async () => {
    const svc = new NestService();
    svc.markStarted();
    const body = await svc.buildStatus("127.0.0.1", 8080);

    expect(body.status).toBe("running");
    expect(body.version).toBe(ROOT_VERSION);
    expect(typeof body.tools).toBe("number");
    expect(typeof body.cron_jobs).toBe("number");
    expect(body.uptime_seconds).not.toBeNull();
    expect(body.sessions).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        by_platform: expect.any(Object),
      }),
    );
    expect(body.memory).toEqual(
      expect.objectContaining({
        files_count: expect.any(Number),
        files_bytes: expect.any(Number),
        facts_count: expect.any(Number),
        l2_index_rows: expect.any(Number),
      }),
    );
    expect(body.platforms).toBeTypeOf("object");
  });

  it("health returns status ok", () => {
    expect(new NestService().health()).toEqual({
      status: "ok",
      version: ROOT_VERSION,
    });
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
