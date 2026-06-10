import { describe, it, expect } from "bun:test";
import {
  ACPClient,
  ACPError,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_PROMPT_TIMEOUT_MS,
  resolveAcpRequestTimeoutMs,
} from "./client.ts";

describe("resolveAcpRequestTimeoutMs", () => {
  it("session/prompt uses prompt timeout", () => {
    expect(resolveAcpRequestTimeoutMs("session/prompt")).toBe(DEFAULT_PROMPT_TIMEOUT_MS);
    expect(resolveAcpRequestTimeoutMs("session/prompt", { prompt_timeout_ms: 60_000 })).toBe(
      60_000,
    );
  });

  it("other methods use connect timeout", () => {
    expect(resolveAcpRequestTimeoutMs("initialize")).toBe(DEFAULT_CONNECT_TIMEOUT_MS);
    expect(resolveAcpRequestTimeoutMs("session/new", { connect_timeout_ms: 5_000 })).toBe(5_000);
  });
});

describe("ACPClient robustness", () => {
  it("initialize fails fast when child exits immediately", async () => {
    const client = new ACPClient("test-exit", "/bin/false", [], undefined, {
      connect_timeout_ms: 5_000,
    });
    let err: unknown;
    try {
      await client.start();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ACPError);
    const msg = (err as ACPError).message;
    expect(msg.includes("exited with code") || msg.includes("stdin closed")).toBe(true);
  }, 10_000);

  it("fails within connect timeout when no response", async () => {
    const client = new ACPClient(
      "test-hang",
      "node",
      ["-e", "setInterval(() => {}, 999999)"],
      undefined,
      { connect_timeout_ms: 200 },
    );
    let err: unknown;
    try {
      await client.start();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ACPError);
    expect((err as ACPError).message.includes("timed out after 200ms")).toBe(true);
  }, 10_000);

  it("fails before spawn when cwd does not exist", async () => {
    const client = new ACPClient("test-cwd", "/bin/echo", [], "/path/does/not/exist", {
      connect_timeout_ms: 1_000,
    });
    let err: unknown;
    try {
      await client.start();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ACPError);
    expect((err as ACPError).message.includes("cwd does not exist")).toBe(true);
  });
});
