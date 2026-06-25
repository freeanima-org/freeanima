import { test, expect } from "bun:test";

import { readShellPath, replaceShellPath } from "./shell-nav.ts";

test("replaceShellPath 移动壳使用 hash 路由", () => {
  const location = {
    pathname: "/",
    hash: "",
    search: "",
  };
  const stub = {
    location,
    satelliteShell: { isNativeShell: true },
    history: {
      replaceState() {
        /* browser 路由备用 */
      },
    },
  } as unknown as Window & typeof globalThis & { satelliteShell: { isNativeShell: boolean } };

  const prevWindow = globalThis.window;
  globalThis.window = stub;
  try {
    replaceShellPath("/chat");
    expect(location.hash).toBe("#/chat");
    expect(readShellPath()).toBe("/chat");
    replaceShellPath("/chat");
    expect(location.hash).toBe("#/chat");
  } finally {
    globalThis.window = prevWindow;
  }
});
