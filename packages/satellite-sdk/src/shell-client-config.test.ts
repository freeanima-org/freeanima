import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadShellClientConfig,
  normalizeShellClientConfig,
  parseShellClientConfig,
  saveShellClientConfig,
} from "./shell-client-config-node.ts";

describe("shell-client-config", () => {
  test("parseShellClientConfig validates fields", () => {
    expect(parseShellClientConfig({ hubUrl: "https://a.com", remoteAuthToken: "tok" })).toEqual({
      hubUrl: "https://a.com",
      remoteAuthToken: "tok",
    });
    expect(parseShellClientConfig({ hubUrl: "https://a.com" })).toBeNull();
  });

  test("save and load roundtrip", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-shell-"));
    try {
      saveShellClientConfig(
        { hubUrl: "https://hub.example.com", remoteAuthToken: "secret-token-min-16" },
        home,
      );
      expect(loadShellClientConfig(home)).toEqual({
        hubUrl: "https://hub.example.com",
        remoteAuthToken: "secret-token-min-16",
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
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
