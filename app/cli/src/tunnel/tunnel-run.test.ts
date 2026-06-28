import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  cloudflaredRunArgv,
  cloudflaredRunExecStart,
  readTunnelConnectorToken,
} from "./tunnel-run.ts";

/** 测试用 connector token（非真实凭证，避免 gitleaks 误报） */
const TEST_CONNECTOR_TOKEN = "anima-test-connector-token";

describe("tunnel-run", () => {
  test("readTunnelConnectorToken reads token file", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-tunnel-"));
    const path = join(dir, "credentials.json");
    writeFileSync(path, TEST_CONNECTOR_TOKEN, "utf-8");
    expect(readTunnelConnectorToken(path)).toBe(TEST_CONNECTOR_TOKEN);
  });

  test("cloudflaredRunArgv uses --token for connector token file", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-tunnel-"));
    const creds = join(dir, "credentials.json");
    writeFileSync(creds, TEST_CONNECTOR_TOKEN, "utf-8");
    const argv = cloudflaredRunArgv("/bin/cloudflared", {
      credentialsFile: creds,
      configFile: join(dir, "config.yml"),
    });
    expect(argv).toEqual(["/bin/cloudflared", "tunnel", "run", "--token-file", creds]);
  });

  test("cloudflaredRunExecStart reads token from file at runtime", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-tunnel-exec-"));
    const creds = join(dir, "credentials.json");
    writeFileSync(creds, TEST_CONNECTOR_TOKEN, "utf-8");
    const exec = cloudflaredRunExecStart("/bin/cloudflared", {
      credentialsFile: creds,
      configFile: join(dir, "config.yml"),
    });
    expect(exec).toContain("tunnel run --token-file");
    expect(exec).toContain(creds);
  });
});
