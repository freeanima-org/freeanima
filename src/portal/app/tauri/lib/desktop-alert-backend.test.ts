import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDesktopAlertBackend } from "./desktop-alert-backend.ts";

type ShellStub = {
  showNativeAlert: (payload: { title: string }) => Promise<void>;
  requestNativeAlertPermission: () => Promise<"granted" | "denied" | "default" | "unsupported">;
  readNativeAlertPermission?: () => Promise<"granted" | "denied" | "default" | "unsupported">;
};

const prevWindow = globalThis.window;

function installShell(stub: ShellStub): void {
  (globalThis as { window?: Window }).window = {
    portalShell: stub,
    setTimeout,
    clearTimeout,
  } as unknown as Window;
}

beforeEach(() => {
  (globalThis as { window?: Window }).window = { portalShell: undefined } as unknown as Window;
});

afterEach(() => {
  if (prevWindow) (globalThis as { window?: Window }).window = prevWindow;
  else delete (globalThis as { window?: Window }).window;
});

describe("createDesktopAlertBackend", () => {
  test("lenient：权限 IPC 失败仍调用原生 show", async () => {
    const shown: string[] = [];
    installShell({
      showNativeAlert: async (payload) => {
        shown.push(payload.title);
      },
      requestNativeAlertPermission: async () => {
        throw new Error("command not found");
      },
      readNativeAlertPermission: async () => {
        throw new Error("command not found");
      },
    });

    const backend = createDesktopAlertBackend({ permissionMode: "lenient" });
    expect(await backend.readPermission()).toBe("granted");
    await backend.show({ title: "hello" });
    expect(shown).toEqual(["hello"]);
  });

  test("lenient：原生 show 失败时回退 Web Notification", async () => {
    installShell({
      showNativeAlert: async () => {
        throw new Error("native failed");
      },
      requestNativeAlertPermission: async () => "granted",
      readNativeAlertPermission: async () => "granted",
    });
    // web-backend 用 window.setTimeout；installShell 已挂
    const OriginalNotification = globalThis.Notification;
    let webTitle = "";
    // @ts-expect-error test stub
    globalThis.Notification = class {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title: string) {
        webTitle = title;
      }
      addEventListener(type: string, listener: () => void) {
        if (type === "show") queueMicrotask(listener);
      }
      close() {}
    };

    try {
      const backend = createDesktopAlertBackend({ permissionMode: "lenient" });
      await backend.show({ title: "fallback" });
      expect(webTitle).toBe("fallback");
    } finally {
      globalThis.Notification = OriginalNotification;
    }
  });

  test("strict：denied 不展示", async () => {
    const shown: string[] = [];
    installShell({
      showNativeAlert: async (payload) => {
        shown.push(payload.title);
      },
      requestNativeAlertPermission: async () => "denied",
      readNativeAlertPermission: async () => "denied",
    });

    const backend = createDesktopAlertBackend({ permissionMode: "strict" });
    await backend.show({ title: "nope" });
    expect(shown).toEqual([]);
  });
});
