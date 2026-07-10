import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { createServiceApiTokenWithSecret } from "@freeanima/core/db/pg/service-api-token";
import { getAppRuntime } from "@freeanima/platform/ports";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";

import { createApiApp } from "@freeanima/features/console/hub/console-api/elysia/app.ts";
import { bindConsoleRuntimeContext } from "@freeanima/features/console/hub/console-api/handlers/runtime.ts";
import {
  applyHttpAuth,
  isHubApiPath,
} from "@freeanima/features/console/hub/console-api/http-dispatch.ts";
import { createServiceAuthVerifier } from "@freeanima/features/console/hub/console-api/service-auth.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

describePg("service API tokens", () => {
  const prev = process.env.FREEANIMA_HOME;
  const apiApp = createApiApp().compile();
  const serviceAuth = createServiceAuthVerifier();

  async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
    const req = new Request(`http://127.0.0.1:2658${path}`, init);
    const auth = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    if (auth.blocked) return auth.blocked;
    const authedReq = auth.req;
    const authedPath = new URL(authedReq.url).pathname;
    if (isHubApiPath(authedPath)) {
      return apiApp.fetch(authedReq);
    }
    const sapDeps = getSapServerDeps();
    if (!sapDeps) return new Response("Not Found", { status: 404 });
    const sapHandlers = createSapBunHandlers(sapDeps);
    const sapRes = await sapHandlers.fetch(authedReq, undefined as never);
    return sapRes ?? new Response("Not Found", { status: 404 });
  }

  afterAll(async () => {
    await endIntegrationCase();
  });

  describe("HTTP auth", () => {
    beforeEach(async () => {
      await beginIntegrationCase("freeanima-svc-auth-");
      bindConsoleRuntimeContext();
      getAppRuntime().markStarted();
    });

    afterEach(async () => {
      await restoreIntegrationHome(prev);
    });

    it("GET /hub/rpc/v1/health/probe without token returns ok and authed=false", async () => {
      const res = await hubFetch("/hub/rpc/v1/health/probe");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(false);
    });

    it("GET /api/status 已移除", async () => {
      const res = await hubFetch("/api/status");
      expect(res.status).toBe(401);
    });

    it("GET /api/status with valid Bearer token returns 404", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const { plaintext } = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "integration-test",
      });

      const res = await hubFetch("/api/status", {
        headers: { Authorization: `Bearer ${plaintext}` },
      });
      expect(res.status).toBe(404);
    });

    it("POST /mcp on loopback without token returns 401", async () => {
      const res = await hubFetch("/mcp", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("GET /hub/rpc/v1/health/probe with valid Bearer reports authed=true", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const { plaintext } = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "health-authed",
      });

      const res = await hubFetch("/hub/rpc/v1/health/probe", {
        headers: { Authorization: `Bearer ${plaintext}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(true);
    });
  });
});
