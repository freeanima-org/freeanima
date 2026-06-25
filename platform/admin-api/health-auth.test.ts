import { describe, expect, test } from "bun:test";
import { evaluateHealthAuthed } from "./health-auth.ts";
import { evaluateRemoteAuthAuthed, isHealthProbePath } from "./remote-auth.ts";
import { createRemoteAuthVerifier } from "./remote-auth.ts";

describe("health-auth", () => {
  test("isHealthProbePath", () => {
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/health"))).toBe(true);
    expect(isHealthProbePath(new Request("https://remote.example/api/health"))).toBe(true);
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
    expect(
      isHealthProbePath(new Request("http://127.0.0.1:2658/api/health", { method: "POST" })),
    ).toBe(false);
  });

  test("GET /api/health 任意 Host 绕过 remote_auth 中间件", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/health");
    expect(await verifier.verifyRequest(req, "127.0.0.1")).toBeNull();
  });

  test("evaluateRemoteAuthAuthed loopback 直连", () => {
    const req = new Request("http://127.0.0.1:2658/api/health");
    expect(evaluateRemoteAuthAuthed(req, "127.0.0.1", "secret-token-min-16")).toBe(true);
  });

  test("evaluateRemoteAuthAuthed 远程无 token", () => {
    const req = new Request("https://remote.example/api/health");
    expect(evaluateRemoteAuthAuthed(req, "10.0.0.1", "secret-token-min-16")).toBe(false);
  });

  test("evaluateRemoteAuthAuthed 远程 Bearer 匹配", () => {
    const req = new Request("https://remote.example/api/health", {
      headers: { Authorization: "Bearer secret-token-min-16" },
    });
    expect(evaluateRemoteAuthAuthed(req, "10.0.0.1", "secret-token-min-16")).toBe(true);
  });

  test("evaluateHealthAuthed 远程错误 Bearer", () => {
    const authed = evaluateHealthAuthed(
      new Request("https://remote.example/api/health", {
        headers: { Authorization: "Bearer wrong" },
      }),
      "10.0.0.1",
      { remoteAuth: { token: "secret-token-min-16" } },
    );
    expect(authed).toBe(false);
  });

  test("evaluateHealthAuthed 远程正确 Bearer", () => {
    const authed = evaluateHealthAuthed(
      new Request("https://remote.example/api/health", {
        headers: { Authorization: "Bearer secret-token-min-16" },
      }),
      "10.0.0.1",
      { remoteAuth: { token: "secret-token-min-16" } },
    );
    expect(authed).toBe(true);
  });
});
