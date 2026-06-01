import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_VERSION = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, "../../../../package.json"), "utf8"),
  ) as { version: string }
).version;

describePg("server status API", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-status-");
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("buildStatus matches WebUI / 卧室 contract", async () => {
    const { NestService } = await import("@freeanima/core");
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

  it("health returns status ok", async () => {
    const { NestService } = await import("@freeanima/core");
    expect(new NestService().health()).toEqual({
      status: "ok",
      version: ROOT_VERSION,
    });
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});