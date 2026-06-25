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
import { normalizeShellClientConfig, parseShellClientConfig } from "./shell-client-config.ts";

describe("shell-client-config", () => {
  test("parseShellClientConfig validates fields", () => {
    expect(parseShellClientConfig({ hubUrl: "https://a.com", remoteAuthToken: "tok" })).toEqual({
      hubUrl: "https://a.com",
      remoteAuthToken: "tok",
    });
    expect(parseShellClientConfig({ hubUrl: "https://a.com" })).toBeNull();
  });

  test("normalizeShellClientConfig trims hub url", () => {
    expect(
      normalizeShellClientConfig({
        hubUrl: "https://hub.example.com/",
        remoteAuthToken: " secret ",
      }),
    ).toEqual({
      hubUrl: "https://hub.example.com",
      remoteAuthToken: "secret",
    });
  });
});

describe("shell-debug-config", () => {
  test("parseShellDebugConfig defaults", () => {
    expect(parseShellDebugConfig(null)).toEqual({
      sentryEnabled: false,
      sentryDsn: "",
      vConsoleEnabled: false,
    });
  });

  test("normalizeShellDebugConfig requires dsn when enabled", () => {
    expect(() =>
      normalizeShellDebugConfig({ sentryEnabled: true, sentryDsn: "", vConsoleEnabled: false }),
    ).toThrow("DSN");
  });
});

describe("shell-settings-node", () => {
  test("save and load roundtrip", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-desktop-"));
    try {
      saveShellClientConfig(
        { hubUrl: "https://hub.example.com", remoteAuthToken: "secret-token-min-16" },
        home,
      );
      expect(loadShellClientConfig(home)).toEqual({
        hubUrl: "https://hub.example.com",
        remoteAuthToken: "secret-token-min-16",
      });
      saveShellDebugConfig(
        {
          sentryEnabled: true,
          sentryDsn: "https://key@o0.ingest.sentry.io/1",
          vConsoleEnabled: true,
        },
        home,
      );
      expect(loadShellDebugConfig(home)).toEqual({
        sentryEnabled: true,
        sentryDsn: "https://key@o0.ingest.sentry.io/1",
        vConsoleEnabled: true,
      });
      expect(loadShellClientConfig(home)?.hubUrl).toBe("https://hub.example.com");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("partial save preserves other sections", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-desktop-"));
    try {
      saveShellSettings(
        {
          hub: { hubUrl: "https://a.com", remoteAuthToken: "token-at-least-16-ch" },
          debug: { sentryEnabled: false, sentryDsn: "", vConsoleEnabled: false },
        },
        home,
      );
      saveShellDebugConfig(
        {
          sentryEnabled: true,
          sentryDsn: "https://key@o0.ingest.sentry.io/1",
          vConsoleEnabled: false,
        },
        home,
      );
      const settings = loadShellSettings(home);
      expect(settings.hub?.hubUrl).toBe("https://a.com");
      expect(settings.debug.sentryEnabled).toBe(true);
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
          hubUrl: "https://legacy.example.com",
          remoteAuthToken: "legacy-token-min-16",
        }),
        "utf-8",
      );
      const prev = process.env.FREEANIMA_HOME;
      process.env.FREEANIMA_HOME = animaHome;
      try {
        const settings = loadShellSettings(desktopHome);
        expect(settings.hub).toEqual({
          hubUrl: "https://legacy.example.com",
          remoteAuthToken: "legacy-token-min-16",
        });
        expect(existsSync(desktopSettingsPath(desktopHome))).toBe(true);
        const written = JSON.parse(readFileSync(desktopSettingsPath(desktopHome), "utf-8")) as {
          hub: { hubUrl: string };
        };
        expect(written.hub.hubUrl).toBe("https://legacy.example.com");
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
