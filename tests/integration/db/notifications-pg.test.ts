import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from "@freeanima/platform/runtime/service-notifications";
import type { RuntimeDeps } from "@freeanima/platform/runtime/runtime-deps";

function testRuntimeDeps(): RuntimeDeps {
  const engine = getTestEngine();
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {
      repos: {
        notifications: engine.repos.notifications,
      },
    } as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describePg("notifications PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-notif-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("create, list unread, markRead", async () => {
    const deps = testRuntimeDeps();
    const store = deps.engine.repos.notifications;

    const created = await createNotification(deps, {
      recipient_kind: "user",
      title: "测试通知",
      body: "正文",
      source_kind: "system",
    });
    expect(created.read_at).toBeNull();

    await createNotification(deps, {
      recipient_kind: "agent",
      title: "Agent 通知",
      body: "agent body",
    });

    const userUnread = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "unread",
    });
    expect(userUnread.total).toBe(1);
    expect(userUnread.items[0]?.title).toBe("测试通知");

    const marked = await markNotificationRead(deps, created.id);
    expect(marked?.read_at).not.toBeNull();

    const stillUnread = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "unread",
    });
    expect(stillUnread.total).toBe(0);

    const all = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "all",
    });
    expect(all.total).toBe(1);
    expect(all.items[0]?.read_at).not.toBeNull();

    const agentUnread = await store.count({
      recipient_kind: "agent",
      read_filter: "unread",
    });
    expect(agentUnread).toBe(1);
  });
});
