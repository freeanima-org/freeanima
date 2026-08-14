import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  hashServiceApiTokenSecret,
  revealServiceApiTokenPlaintext,
  revokeServiceApiToken,
  updateServiceApiTokenName,
} from "@freeanima/habitat/core/db/pg/service-api-token";
import { createServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token/repos/token-repo.ts";
import { getAppRuntime } from "@freeanima/habitat/platform";
import {
  builtinFeaturePlugins,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "@freeanima/habitat/platform/features";
import { createSapBunHandlers } from "@freeanima/habitat/capabilities/outpost/transport/bun-route";
import {
  bindRemoteToolsServerDeps,
  clearRemoteToolsServerDeps,
  getRemoteToolsServerDeps,
} from "@freeanima/habitat/capabilities/outpost/transport/runtime-context";
import { RemoteInstanceRegistry } from "@freeanima/habitat/capabilities/outpost/transport/instance-registry";
import { HabitatSessionRegistry } from "@freeanima/habitat/capabilities/outpost/transport/habitat-session-registry";
import type { RemoteToolsManager } from "@freeanima/habitat/capabilities/outpost";

import { bindHabitatRuntimeContext } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts";
import { applyHttpAuth } from "@freeanima/features/habitat/habitat/habitat-api/http-dispatch.ts";
import { createServiceAuthVerifier } from "@freeanima/features/habitat/habitat/habitat-api/service-auth.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

describePg("service API tokens", () => {
  const prev = process.env.FREEANIMA_HOME;
  const serviceAuth = createServiceAuthVerifier();

  async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
    const req = new Request(`http://127.0.0.1:2658${path}`, init);
    const auth = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    if (auth.blocked) return auth.blocked;
    const authedReq = auth.req;
    const sapDeps = getRemoteToolsServerDeps();
    if (!sapDeps) return new Response("Not Found", { status: 404 });
    const sapHandlers = createSapBunHandlers(sapDeps);
    const sapRes = await sapHandlers.fetch(authedReq, undefined as never);
    return sapRes ?? new Response("Not Found", { status: 404 });
  }

  afterAll(async () => {
    clearRemoteToolsServerDeps();
    await endIntegrationCase();
  });

  describe("HTTP auth", () => {
    beforeEach(async () => {
      await beginIntegrationCase("freeanima-svc-auth-");
      bindHabitatRuntimeContext();
      registerFeatures(builtinFeaturePlugins);
      const runtime = getAppRuntime();
      runtime.markStarted();
      bindRemoteToolsServerDeps({
        runtime,
        remoteToolsManager: runtime.fullDeps().outpost as RemoteToolsManager,
        instanceRegistry: new RemoteInstanceRegistry(false),
        hubSessionRegistry: new HabitatSessionRegistry(),
        animaVersion: "test",
      });
    });

    afterEach(async () => {
      clearRemoteToolsServerDeps();
      resetFeatureRegistryForTests();
      await restoreIntegrationHome(prev);
    });

    it("GET /rpc/v1/health/probe without token returns ok and authed=false", async () => {
      const res = await hubFetch("/rpc/v1/health/probe");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(false);
    });

    it("GET /api/status 已移除", async () => {
      const res = await hubFetch("/api/status");
      expect(res.status).toBe(401);
    });

    it("POST /mcp on loopback without token returns 401", async () => {
      const res = await hubFetch("/mcp", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("GET /rpc/v1/health/probe with valid Bearer reports authed=true", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const { plaintext } = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "health-authed",
      });

      const res = await hubFetch("/rpc/v1/health/probe", {
        headers: { Authorization: `Bearer ${plaintext}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; authed: boolean };
      expect(body.status).toBe("ok");
      expect(body.authed).toBe(true);
    });
  });

  describe("reveal / rename", () => {
    beforeEach(async () => {
      await beginIntegrationCase("freeanima-svc-token-mgmt-");
      bindHabitatRuntimeContext();
      registerFeatures(builtinFeaturePlugins);
      const runtime = getAppRuntime();
      runtime.markStarted();
    });

    afterEach(async () => {
      resetFeatureRegistryForTests();
      await restoreIntegrationHome(prev);
    });

    it("create → reveal roundtrip and rename", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const created = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "desktop",
      });
      expect(created.token.revealable).toBe(true);

      const revealed = await revealServiceApiTokenPlaintext(created.token.id);
      expect(revealed).toBe(created.plaintext);

      const renamed = await updateServiceApiTokenName(created.token.id, "laptop");
      expect(renamed.name).toBe("laptop");
      const row = await getServiceApiTokenById(created.token.id);
      expect(row?.name).toBe("laptop");
    });

    it("reveal fails for legacy token without secret and for revoked token", async () => {
      const { user_subject_id } = getResolvedWorldContext();
      const hash = await hashServiceApiTokenSecret("legacy-secret");
      const legacy = await createServiceApiToken({
        subject_id: user_subject_id,
        name: "legacy",
        prefix: `leg${Date.now().toString(36)}`.slice(0, 12),
        token_hash: hash,
        token_secret: null,
      });
      expect(legacy.revealable).toBe(false);
      await expect(revealServiceApiTokenPlaintext(legacy.id)).rejects.toThrow(/not revealable/);

      const created = await createServiceApiTokenWithSecret({
        subject_id: user_subject_id,
        name: "to-revoke",
      });
      await revokeServiceApiToken(created.token.id);
      await expect(revealServiceApiTokenPlaintext(created.token.id)).rejects.toThrow(
        /revoked or expired/,
      );
    });
  });
});
