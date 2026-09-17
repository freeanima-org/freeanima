import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { registerAlertBackend, resetAlertBackendForTest } from "./alert/deliver.ts";
import type { AlertBackend, AlertPayload } from "./alert/types.ts";
import type { ShellApi } from "./shell-api.ts";
import { deliverLocalReminder, isCompanionReminderPreferred } from "./local-reminder.ts";

function mockAlertBackend() {
  const shown: AlertPayload[] = [];
  const backend: AlertBackend = {
    platform: "web",
    scheduleDurability: "none",
    readPermission: async () => "granted",
    requestPermission: async () => "granted",
    show: async (payload) => {
      shown.push(payload);
    },
    schedule: async () => ({ id: "n/a" }),
    cancel: async () => undefined,
  };
  registerAlertBackend(backend);
  return { shown };
}

describe("deliverLocalReminder", () => {
  const prevWindow = globalThis.window;

  beforeEach(() => {
    resetAlertBackendForTest();
    const doc = { visibilityState: "hidden" } as Document;
    (globalThis as { document?: Document }).document = doc;
    (globalThis as { window?: Window }).window = {
      location: { pathname: "/other", hash: "" },
      document: doc,
    } as unknown as Window;
  });

  afterEach(() => {
    resetAlertBackendForTest();
    if (prevWindow) (globalThis as { window?: Window }).window = prevWindow;
    else delete (globalThis as { window?: Window }).window;
    delete (globalThis as { document?: Document }).document;
  });

  test("无伴侣 API 时走 alert", async () => {
    const { shown } = mockAlertBackend();
    (window as Window & { portalShell?: ShellApi }).portalShell = {
      habitatUrl: "",
      habitatWsUrl: "",
      createFileInstanceStore: () => ({ load: () => null, save: () => undefined }),
    };
    const channel = await deliverLocalReminder({
      title: "未读",
      body: "有新消息",
      tag: "chat-unread",
      sourceRoute: "/chat",
    });
    expect(channel).toBe("alert");
    expect(shown).toHaveLength(1);
    expect(shown[0]?.title).toBe("未读");
  });

  test("companion 可见时走气泡且不弹 OS", async () => {
    const { shown } = mockAlertBackend();
    const bubbles: string[] = [];
    (window as Window & { portalShell?: ShellApi }).portalShell = {
      habitatUrl: "",
      habitatWsUrl: "",
      createFileInstanceStore: () => ({ load: () => null, save: () => undefined }),
      getCompanionVisible: async () => true,
      enqueueCompanionBubble: async (text) => {
        bubbles.push(text);
      },
    };
    const channel = await deliverLocalReminder({
      title: "番茄结束",
      body: "休息一下",
      sourceRoute: "/pomodoro",
    });
    expect(channel).toBe("companion_bubble");
    expect(bubbles).toEqual(["番茄结束\n休息一下"]);
    expect(shown).toHaveLength(0);
  });

  test("companion 隐藏时走 alert", async () => {
    const { shown } = mockAlertBackend();
    (window as Window & { portalShell?: ShellApi }).portalShell = {
      habitatUrl: "",
      habitatWsUrl: "",
      createFileInstanceStore: () => ({ load: () => null, save: () => undefined }),
      getCompanionVisible: async () => false,
      enqueueCompanionBubble: async () => undefined,
    };
    const channel = await deliverLocalReminder({
      title: "通知",
      sourceRoute: "/notifications",
    });
    expect(channel).toBe("alert");
    expect(shown).toHaveLength(1);
  });

  test("isCompanionReminderPreferred 无 API 为 false", async () => {
    (window as Window & { portalShell?: ShellApi }).portalShell = {
      habitatUrl: "",
      habitatWsUrl: "",
      createFileInstanceStore: () => ({ load: () => null, save: () => undefined }),
    };
    expect(await isCompanionReminderPreferred()).toBe(false);
  });
});
