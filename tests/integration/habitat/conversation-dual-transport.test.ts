import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { bindHabitatRuntimeContext } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime";
import { chatHabitatRoutes } from "@freeanima/features/chat/habitat/routes/index.ts";
import {
  builtinFeaturePlugins,
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "@freeanima/host/platform/features";
import { getAppRuntime } from "@freeanima/host/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { testConv } from "../../helpers/pg-test.ts";

describePg("habitat conversation.list dual transport", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("habitat-dual-");
    bindHabitatRuntimeContext();
    registerFeatures(builtinFeaturePlugins);
    getAppRuntime().markStarted();
  });

  afterEach(async () => {
    resetFeatureRegistryForTests();
    bindHabitatRuntimeContext();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("registry handler 与 chat routes handler 返回相同 conversation_id 集合", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    await c.beginTurn(sid, "dual-transport probe");

    const runtime = getAppRuntime();
    const deps = {
      runtime: runtime as never,
      remoteToolsManager: null as never,
      instanceRegistry: null as never,
      hubSessionRegistry: null as never,
      animaVersion: "test",
      masks: null as never,
    };
    const ctx = {
      app_id: "chat",
      instance_id: "default",
      auth: { subject_id: 1, subject_type: "agent" as const, token_id: 1, scopes: ["full"] },
      sendEvent: () => {},
    };
    const input = { platform: TEST_SAP_CHAT_PLATFORM };

    const registryHandler = getFeatureRpcHandler("conversation.list");
    const routeHandler = chatHabitatRoutes.handlers["conversation.list"];
    if (!registryHandler || !routeHandler) {
      throw new Error("conversation.list handler missing");
    }

    const registryResult = (await registryHandler(deps, input, ctx)) as {
      conversations: Array<{ conversation_id: string }>;
    };
    const routeResult = (await routeHandler(deps, input, ctx)) as {
      conversations: Array<{ conversation_id: string }>;
    };

    const registryIds = new Set(registryResult.conversations.map((row) => row.conversation_id));
    const routeIds = new Set(routeResult.conversations.map((row) => row.conversation_id));
    expect(registryIds.has(sid)).toBe(true);
    expect(routeIds.has(sid)).toBe(true);
    expect(registryIds).toEqual(routeIds);
  });
});
