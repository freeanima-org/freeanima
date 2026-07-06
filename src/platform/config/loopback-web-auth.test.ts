import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  loopbackWebAuthTokenPath,
  readLoopbackWebAuthTokenFromEnvOrFile,
  writeLoopbackWebAuthTokenFile,
} from "./loopback-web-auth.ts";

describe("loopback-web-auth", () => {
  test("readLoopbackWebAuthTokenFromEnvOrFile prefers env", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-loopback-"));
    const prevHome = process.env.FREEANIMA_HOME;
    const prevEnv = process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
    process.env.FREEANIMA_HOME = home;
    process.env.FREEANIMA_REMOTE_AUTH_TOKEN = "anima_env_token_123456";
    try {
      expect(readLoopbackWebAuthTokenFromEnvOrFile()).toBe("anima_env_token_123456");
    } finally {
      if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
      else process.env.FREEANIMA_HOME = prevHome;
      if (prevEnv === undefined) delete process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
      else process.env.FREEANIMA_REMOTE_AUTH_TOKEN = prevEnv;
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("writeLoopbackWebAuthTokenFile persists token under FREEANIMA_HOME", () => {
    const home = mkdtempSync(join(tmpdir(), "anima-loopback-"));
    const prevHome = process.env.FREEANIMA_HOME;
    const prevEnv = process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
    process.env.FREEANIMA_HOME = home;
    delete process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
    try {
      writeLoopbackWebAuthTokenFile("anima_file_token_123456");
      expect(readLoopbackWebAuthTokenFromEnvOrFile()).toBe("anima_file_token_123456");
      expect(readFileSync(loopbackWebAuthTokenPath(), "utf-8").trim()).toBe(
        "anima_file_token_123456",
      );
    } finally {
      if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
      else process.env.FREEANIMA_HOME = prevHome;
      if (prevEnv === undefined) delete process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
      else process.env.FREEANIMA_REMOTE_AUTH_TOKEN = prevEnv;
      rmSync(home, { recursive: true, force: true });
    }
  });
});
