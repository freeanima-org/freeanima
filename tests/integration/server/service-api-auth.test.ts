import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { SERVICE_API_TOKEN_PREFIX } from "@freeanima/core/db/pg/service-api-token";
import {
  countServiceApiTokens,
  createServiceApiTokenWithSecret,
  listServiceApiTokensBySubject,
  verifyServiceApiToken,
} from "@freeanima/core/db/pg/service-api-token";
import { getAppRuntime } from "@freeanima/platform/ports";
import { FileConfig } from "@freeanima/platform/config";

import { createApiApp } from "../../../platform/admin-api/elysia/app.ts";
import { bindAdminRuntimeContext } from "../../../platform/admin-api/handlers/runtime.ts";
import { applyHttpAuth } from "../../../platform/admin-api/http-dispatch.ts";
import { createServiceAuthVerifier } from "../../../platform/admin-api/service-auth.ts";
import { bootServiceApiTokensPhase } from "../../../platform/src/boot/service-api-tokens-phase.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  beginIntegrationCaseWithConfig,
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

  describe("boot migration", () => {
    const legacyToken = "legacy-remote-auth-token-16";

    beforeEach(async () => {
      await beginIntegrationCaseWithConfig(
        "freeanima-svc-auth-migrate-",
        `\nremote_auth:\n  token: ${JSON.stringify(legacyToken)}\n`,
      );
    });

    afterEach(async () => {
      await restoreIntegrationHome(prev);
    });

    it("migrates remote_auth.token into service_api_tokens when table is empty", async () => {
      expect(await countServiceApiTokens()).toBe(0);

      await bootServiceApiTokensPhase(FileConfig.open());

      expect(await countServiceApiTokens()).toBe(1);
      const { user_subject_id } = getResolvedWorldContext();
      const items = await listServiceApiTokensBySubject(user_subject_id);
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe("migrated from remote_auth");

      const migratedPlaintext = `${SERVICE_API_TOKEN_PREFIX}${items[0]!.prefix}_${legacyToken}`;
      expect(await verifyServiceApiToken(migratedPlaintext)).toEqual(
        expect.objectContaining({
          subject_id: user_subject_id,
          scopes: ["full"],
        }),
      );
    });
  });
});
