import { describe, it, expect } from "vitest";
import {
  ACPClient,
  ACPError,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_PROMPT_TIMEOUT_MS,
  resolveAcpRequestTimeoutMs,
} from "../../src/acp/client.js";

describe("resolveAcpRequestTimeoutMs", () => {
  it("session/prompt 使用 prompt 超时", () => {
    expect(resolveAcpRequestTimeoutMs("session/prompt")).toBe(DEFAULT_PROMPT_TIMEOUT_MS);
    expect(resolveAcpRequestTimeoutMs("session/prompt", { prompt_timeout_ms: 60_000 })).toBe(60_000);
  });

  it("其他方法使用 connect 超时", () => {
    expect(resolveAcpRequestTimeoutMs("initialize")).toBe(DEFAULT_CONNECT_TIMEOUT_MS);
    expect(resolveAcpRequestTimeoutMs("session/new", { connect_timeout_ms: 5_000 })).toBe(5_000);
  });
});

describe("ACPClient 健壮性", () => {
  it("子进程立即退出时 initialize 快速失败", async () => {
    const client = new ACPClient("test-exit", "/bin/false", [], undefined, {
      connect_timeout_ms: 5_000,
    });
    await expect(client.start()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ACPError);
      const msg = (err as ACPError).message;
      return msg.includes("exited with code") || msg.includes("stdin closed");
    });
  }, 10_000);

  it("无响应时在 connect 超时内失败", async () => {
    const client = new ACPClient(
      "test-hang",
      "node",
      ["-e", "setInterval(() => {}, 999999)"],
      undefined,
      { connect_timeout_ms: 200 },
    );
    await expect(client.start()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ACPError);
      return (err as ACPError).message.includes("timed out after 200ms");
    });
  }, 10_000);

  it("cwd 不存在时在 spawn 前失败", async () => {
    const client = new ACPClient(
      "test-cwd",
      "/bin/echo",
      [],
      "/path/does/not/exist",
      { connect_timeout_ms: 1_000 },
    );
    await expect(client.start()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ACPError);
      return (err as ACPError).message.includes("cwd does not exist");
    });
  });
});
