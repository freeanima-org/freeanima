import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { desktopSettingsPath, legacyShellClientConfigPath } from "./desktop-settings-paths.ts";
import { normalizeShellDebugConfig, parseShellDebugConfig } from "./shell-debug-config.ts";
import {
  loadShellClientConfig,
  loadShellDebugConfig,
  loadShellSettings,
  saveShellClientConfig,
  saveShellDebugConfig,
  saveShellSettings,
} from "./shell-settings-node.ts";
import {
  normalizeShellClientConfig,
  parseShellClientConfig,
  shellClientNeedsHabitatSetup,
} from "./shell-client-config.ts";

describe("shell-client-config", () => {
  test("parseShellClientConfig validates fields", () => {
    expect(parseShellClientConfig({ habitatUrl: "https://a.com", remoteAuthToken: "tok" })).toEqual(
      {
        habitatUrl: "https://a.com",
        remoteAuthToken: "tok",
      },
    );
    expect(parseShellClientConfig({ habitatUrl: "https://a.com" })).toEqual({
      habitatUrl: "https://a.com",
      remoteAuthToken: "",
    });
  });

  test("normalizeShellClientConfig allows empty token", () => {
    expect(
      normalizeShellClientConfig({
        habitatUrl: "http://192.168.1.10:2658",
        remoteAuthToken: "",
      }),
    ).toEqual({
      habitatUrl: "http://192.168.1.10:2658",
      remoteAuthToken: "",
    });
  });

  test("shellClientNeedsHabitatSetup when token missing", () => {
    expect(shellClientNeedsHabitatSetup(null)).toBe(true);
    expect(
      shellClientNeedsHabitatSetup({ habitatUrl: "https://hub.example.com", remoteAuthToken: "" }),
    ).toBe(true);
    expect(
      shellClientNeedsHabitatSetup({
        habitatUrl: "https://hub.example.com",
        remoteAuthToken: "tok",
      }),
    ).toBe(false);
  });

  test("normalizeShellClientConfig trims habitat url", () => {
    expect(
      normalizeShellClientConfig({
        habitatUrl: "https://hub.example.com/",
        remoteAuthToken: " secret ",
      }),
    ).toEqual({
      habitatUrl: "https://hub.example.com",
      remoteAuthToken: "secret",
    });
  });
});

describe("shell-debug-config", () => {
  test("parseShellDebugConfig defaults", () => {
    expect(parseShellDebugConfig(null)).toEqual({
      vConsoleEnabled: false,
    });
  });

  test("normalizeShellDebugConfig passes through vConsole", () => {
    expect(normalizeShellDebugConfig({ vConsoleEnabled: true })).toEqual({
      vConsoleEnabled: true,
    });
  });
});

describe("shell-settings-node", () => {
  test("save and load roundtrip", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-desktop-"));
    try {
      saveShellClientConfig(
        { habitatUrl: "https://hub.example.com", remoteAuthToken: "secret-token-min-16" },
        home,
      );
      expect(loadShellClientConfig(home)).toEqual({
        habitatUrl: "https://hub.example.com",
        remoteAuthToken: "secret-token-min-16",
      });
      saveShellDebugConfig(
        {
          vConsoleEnabled: true,
        },
        home,
      );
      expect(loadShellDebugConfig(home)).toEqual({
        vConsoleEnabled: true,
      });
      expect(loadShellClientConfig(home)?.habitatUrl).toBe("https://hub.example.com");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("partial save preserves other sections", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-desktop-"));
    try {
      saveShellSettings(
        {
          habitat: { habitatUrl: "https://a.com", remoteAuthToken: "token-at-least-16-ch" },
          debug: { vConsoleEnabled: false },
        },
        home,
      );
      saveShellDebugConfig(
        {
          vConsoleEnabled: true,
        },
        home,
      );
      const settings = loadShellSettings(home);
      expect(settings.habitat?.habitatUrl).toBe("https://a.com");
      expect(settings.debug.vConsoleEnabled).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("migrates legacy ~/.anima/shell-client.json", () => {
    const animaHome = mkdtempSync(join(tmpdir(), "anima-legacy-"));
    const desktopHome = mkdtempSync(join(tmpdir(), "anima-desktop-mig-"));
    try {
      writeFileSync(
        legacyShellClientConfigPath(animaHome),
        JSON.stringify({
          habitatUrl: "https://legacy.example.com",
          remoteAuthToken: "legacy-token-min-16",
        }),
        "utf-8",
      );
      const prev = process.env.FREEANIMA_HOME;
      process.env.FREEANIMA_HOME = animaHome;
      try {
        const settings = loadShellSettings(desktopHome);
        expect(settings.habitat).toEqual({
          habitatUrl: "https://legacy.example.com",
          remoteAuthToken: "legacy-token-min-16",
        });
        expect(existsSync(desktopSettingsPath(desktopHome))).toBe(true);
        const written = JSON.parse(readFileSync(desktopSettingsPath(desktopHome), "utf-8")) as {
          habitat: { habitatUrl: string };
        };
        expect(written.habitat.habitatUrl).toBe("https://legacy.example.com");
      } finally {
        if (prev === undefined) delete process.env.FREEANIMA_HOME;
        else process.env.FREEANIMA_HOME = prev;
      }
    } finally {
      rmSync(animaHome, { recursive: true, force: true });
      rmSync(desktopHome, { recursive: true, force: true });
    }
  });
});
