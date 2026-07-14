import { describe, expect, test } from "bun:test";

import {
  resolveDesktopUiMode,
  resolveRemoteShellUiBase,
  shellUiPathToUrl,
} from "./shell-ui-origin.ts";

describe("shell-ui-origin", () => {
  test("默认 local；仅 remote 显式开启", () => {
    const prev = process.env.DESKTOP_UI_MODE;
    try {
      delete process.env.DESKTOP_UI_MODE;
      expect(resolveDesktopUiMode()).toBe("local");
      process.env.DESKTOP_UI_MODE = "bundled";
      expect(resolveDesktopUiMode()).toBe("local");
      process.env.DESKTOP_UI_MODE = "remote";
      expect(resolveDesktopUiMode()).toBe("remote");
    } finally {
      if (prev === undefined) delete process.env.DESKTOP_UI_MODE;
      else process.env.DESKTOP_UI_MODE = prev;
    }
  });

  test("shellUiPathToUrl 拼接 /web base", () => {
    expect(shellUiPathToUrl("http://127.0.0.1:4173/web", "/chat")).toBe(
      "http://127.0.0.1:4173/web/chat",
    );
    expect(resolveRemoteShellUiBase("http://127.0.0.1:2658")).toBe("http://127.0.0.1:2658/web");
  });
});
