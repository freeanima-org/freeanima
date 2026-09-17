import { describe, expect, it } from "bun:test";

import {
  DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY,
  isOfflineOutboxDevtoolsEnabled,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
} from "./shell-debug-config.ts";

describe("isOfflineOutboxDevtoolsEnabled", () => {
  it("DEV 下始终开启", () => {
    expect(
      isOfflineOutboxDevtoolsEnabled({
        isDev: true,
        getItem: () => null,
      }),
    ).toBe(true);
  });

  it("生产仅在 flag=1 时开启", () => {
    expect(
      isOfflineOutboxDevtoolsEnabled({
        isDev: false,
        getItem: () => null,
      }),
    ).toBe(false);
    expect(
      isOfflineOutboxDevtoolsEnabled({
        isDev: false,
        getItem: (key) => (key === DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY ? "1" : null),
      }),
    ).toBe(true);
  });
});

describe("shell-debug-config offlineOutbox", () => {
  it("parse/normalize 含 offlineOutboxDevtoolsEnabled", () => {
    expect(parseShellDebugConfig(null)).toEqual({
      vConsoleEnabled: false,
      offlineOutboxDevtoolsEnabled: false,
    });
    expect(
      normalizeShellDebugConfig({
        vConsoleEnabled: true,
        offlineOutboxDevtoolsEnabled: true,
      }),
    ).toEqual({
      vConsoleEnabled: true,
      offlineOutboxDevtoolsEnabled: true,
    });
  });
});
