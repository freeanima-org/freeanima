import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/runtime/loop";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { getProfileHopModel } from "@freeanima/platform/config";
import { registerDiaryTools } from "@freeanima/feature-diary/domain";
import { registerDreamTools } from "@freeanima/capabilities-memory";
import { createDreamEntry } from "@freeanima/capabilities-memory/dream/entry-store";
import { registerEmailTools } from "@freeanima/feature-email/domain";
import { createEmailAccount } from "@freeanima/feature-email/domain";
import {
  registerNotificationPort,
  registerNotificationTools,
  resetNotificationPortForTests,
} from "@freeanima/capabilities-tools/notification";
import { createNotificationPort } from "@freeanima/platform/runtime/notification-helpers";
import { getActivePgTestContext, getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import { testAgentWorldId, testUserWorldId } from "../../helpers/world-context.ts";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import type { RuntimeDeps } from "@freeanima/platform/runtime/runtime-deps";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

function testRuntimeDeps(): RuntimeDeps {
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: getTestEngine(),
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describePg("world scope tools", () => {
  const prev = process.env.FREEANIMA_HOME;
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-world-scope-");
    registerDiaryTools(toolSets);
    registerDreamTools(toolSets);
    registerEmailTools(toolSets, {
      sendEmail: async () => ({
        ok: true as const,
        messageId: "test",
        account_id: 1,
        message_entity_id: 1,
      }),
      markAsRead: async () => ({ ok: true as const }),
      deleteEmail: async () => ({ ok: true as const }),
      assertPasswordResolvable: async () => {},
    });
    const pgCtx = getActivePgTestContext()!;
    registerNotificationPort(createNotificationPort(testRuntimeDeps(), pgCtx.config));
    registerNotificationTools(toolSets);
  });

  afterEach(async () => {
    resetNotificationPortForTests();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("diary_append defaults to agent world and respects explicit user_world_id", async () => {
    const sid = "sess-diary-world";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    let agentOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_append")!;
        agentOut = await Promise.resolve(
          tool.handler({ content: "agent diary note", date: "2026-07-01" }),
        );
      },
      { tools: toolSets },
    );
    expect(JSON.parse(agentOut).ok).toBe(true);

    const userCallerAuth = {
      token_id: 1,
      subject_id: getResolvedWorldContext().user_subject_id,
      subject_type: "user" as const,
      scopes: ["full"],
    };

    let userOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_append")!;
        userOut = await Promise.resolve(
          tool.handler({
            content: "user diary note",
            date: "2026-07-01",
            world_id: testUserWorldId(),
          }),
        );
      },
      { tools: toolSets, callerAuth: userCallerAuth },
    );
    expect(JSON.parse(userOut).ok).toBe(true);

    let agentGet = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        agentGet = await Promise.resolve(tool.handler({ date: "2026-07-01" }));
      },
      { tools: toolSets },
    );
    const agentParsed = JSON.parse(agentGet) as { ok: boolean; item: { content: string } };
    expect(agentParsed.ok).toBe(true);
    expect(agentParsed.item.content).toContain("agent diary note");
    expect(agentParsed.item.content).not.toContain("user diary note");

    let userGet = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        userGet = await Promise.resolve(
          tool.handler({ date: "2026-07-01", world_id: testUserWorldId() }),
        );
      },
      { tools: toolSets, callerAuth: userCallerAuth },
    );
    const userParsed = JSON.parse(userGet) as { ok: boolean; item: { content: string } };
    expect(userParsed.ok).toBe(true);
    expect(userParsed.item.content).toContain("user diary note");
  });

  it("dream_read scopes by world_id", async () => {
    const sid = "sess-dream-world";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    await createDreamEntry(
      { worldId: testAgentWorldId() },
      { dream_day: "2026-07-02", content: "agent dream" },
    );
    await createDreamEntry(
      { worldId: testUserWorldId() },
      { dream_day: "2026-07-02", content: "user dream" },
    );

    let agentOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("dream_read")!;
        agentOut = await Promise.resolve(tool.handler({ day: "2026-07-02" }));
      },
      { tools: toolSets },
    );
    expect(JSON.parse(agentOut).content).toBe("agent dream");

    let userOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("dream_read")!;
        userOut = await Promise.resolve(
          tool.handler({ day: "2026-07-02", world_id: testUserWorldId() }),
        );
      },
      {
        tools: toolSets,
        callerAuth: {
          token_id: 1,
          subject_id: getResolvedWorldContext().user_subject_id,
          subject_type: "user" as const,
          scopes: ["full"],
        },
      },
    );
    expect(JSON.parse(userOut).content).toBe("user dream");
  });

  it("email_list_accounts scopes by world_id", async () => {
    const sid = "sess-email-world";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const accountInput = {
      address: "scope@test.local",
      password: "secret",
      smtp_host: "smtp.test",
      smtp_port: 587,
      imap_host: "imap.test",
      imap_port: 993,
    };

    await createEmailAccount(testAgentWorldId(), {
      ...accountInput,
      address: "agent@scope.test",
    });
    await createEmailAccount(testUserWorldId(), {
      ...accountInput,
      address: "user@scope.test",
    });

    let agentOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("email_list_accounts")!;
        agentOut = await Promise.resolve(tool.handler({}));
      },
      { tools: toolSets },
    );
    const agentParsed = JSON.parse(agentOut) as { accounts: { address: string }[] };
    expect(agentParsed.accounts.some((a) => a.address === "agent@scope.test")).toBe(true);
    expect(agentParsed.accounts.some((a) => a.address === "user@scope.test")).toBe(false);

    let userOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("email_list_accounts")!;
        userOut = await Promise.resolve(tool.handler({ world_id: testUserWorldId() }));
      },
      {
        tools: toolSets,
        callerAuth: {
          token_id: 1,
          subject_id: getResolvedWorldContext().user_subject_id,
          subject_type: "user" as const,
          scopes: ["full"],
        },
      },
    );
    const userParsed = JSON.parse(userOut) as { accounts: { address: string }[] };
    expect(userParsed.accounts.some((a) => a.address === "user@scope.test")).toBe(true);
    expect(userParsed.accounts.some((a) => a.address === "agent@scope.test")).toBe(false);
  });

  it("notification_send and notification_list use subject_id", async () => {
    const sid = "sess-notif-subject";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const { user_subject_id } = getResolvedWorldContext();

    let sendOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("notification_send")!;
        sendOut = await Promise.resolve(
          tool.handler({
            title: "User scoped",
            body: "hello user inbox",
            subject_id: user_subject_id,
          }),
        );
      },
      { tools: toolSets },
    );
    expect(JSON.parse(sendOut).ok).toBe(true);

    let userList = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("notification_list")!;
        userList = await Promise.resolve(
          tool.handler({ subject_id: user_subject_id, read_filter: "all" }),
        );
      },
      { tools: toolSets },
    );
    const userParsed = JSON.parse(userList) as { items: { title: string }[] };
    expect(userParsed.items.some((i) => i.title === "User scoped")).toBe(true);

    let agentList = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("notification_list")!;
        agentList = await Promise.resolve(tool.handler({ recipient: "agent", read_filter: "all" }));
      },
      { tools: toolSets },
    );
    const agentParsed = JSON.parse(agentList) as { items: { title: string }[] };
    expect(agentParsed.items.some((i) => i.title === "User scoped")).toBe(false);
  });
});
