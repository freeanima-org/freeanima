import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { createServiceApiTokenWithSecret } from "@freeanima/core/db/pg/service-api-token";
import { getAppRuntime } from "@freeanima/platform/ports";

import { createApiApp } from "@freeanima/admin-api/elysia";
import { bindAdminRuntimeContext } from "@freeanima/admin-api/handlers/runtime";
import { applyHttpAuth } from "@freeanima/admin-api/http-dispatch";
import { createServiceAuthVerifier } from "@freeanima/admin-api/service-auth";
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
    return apiApp.fetch(auth.req);
  }

  afterAll(async () => {
    await endIntegrationCase();
  });

  describe("HTTP auth", () => {
    beforeEach(async () => {
      await beginIntegrationCase("freeanima-svc-auth-");
      bindAdminRuntimeContext();
      getAppRuntime().markStarted();
    });

    afterEach(async () => {
      await restoreIntegrationHome(prev);
    });

    it("GET /api/health without token returns ok and authed=false", async () => {
      const res = await hubFetch("/api/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(false);
    });

    it("GET /api/status on loopback without token returns 401", async () => {
      const res = await hubFetch("/api/status");
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
    });

    it("POST /mcp on loopback without token returns 401", async () => {
      const res = await hubFetch("/mcp", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("GET /api/status with valid Bearer token succeeds", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const { plaintext } = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "integration-test",
      });

      const res = await hubFetch("/api/status", {
        headers: { Authorization: `Bearer ${plaintext}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("running");
    });

    it("GET /api/health with valid Bearer reports authed=true", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const { plaintext } = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "health-authed",
      });

      const res = await hubFetch("/api/health", {
        headers: { Authorization: `Bearer ${plaintext}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(true);
    });
  });
});
