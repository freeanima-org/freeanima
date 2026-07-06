import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { bindConsoleRuntimeContext } from "@freeanima/console-api/handlers/runtime";
import { invokeConsoleHubHandler } from "@freeanima/console-api/console-hub-handlers";
import { handleConversationList } from "../../../src/features/chat/hub/rpc.ts";
import { getAppRuntime } from "@freeanima/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import { testConv } from "../../helpers/pg-test.ts";

describePg("hub conversation.list dual transport", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("hub-dual-");
    bindConsoleRuntimeContext();
    getAppRuntime().markStarted();
  });

  afterEach(async () => {
    bindConsoleRuntimeContext();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("HTTP invokeConsoleHubHandler 与 WS feature handler 返回相同 conversation_id 集合", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    await c.beginTurn(sid, "dual-transport probe");

    const httpResult = (await invokeConsoleHubHandler("conversation.list", {
      platform: TEST_SAP_CHAT_PLATFORM,
    })) as { conversations: Array<{ conversation_id: string }> };

    const runtime = getAppRuntime();
    const wsResult = await handleConversationList(
      {
        runtime: runtime as never,
        satelliteManager: null as never,
        instanceRegistry: null as never,
        animaVersion: "test",
        masks: null as never,
      },
      { platform: TEST_SAP_CHAT_PLATFORM },
      {
        app_id: "chat",
        instance_id: "default",
        auth: { subject_id: 1, subject_type: "agent", token_id: 1, scopes: ["full"] },
        sendEvent: () => {},
      },
    );

    const httpIds = new Set(httpResult.conversations.map((row) => row.conversation_id));
    const wsIds = new Set(
      wsResult.conversations.map((row: { conversation_id: string }) => row.conversation_id),
    );
    expect(httpIds.has(sid)).toBe(true);
    expect(wsIds.has(sid)).toBe(true);
    expect(httpIds).toEqual(wsIds);
  });
});
