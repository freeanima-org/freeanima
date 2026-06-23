import { describe, expect, it } from "bun:test";
import { describeApiTokenForLog, formatCloudflareApiFailure } from "./cloudflare-fetch.ts";

describe("describeApiTokenForLog", () => {
  it("masks token value", () => {
    expect(describeApiTokenForLog("abcdefghijklmnop")).toBe("Token: 16 字符，abcd…mnop");
  });

  it("detects unresolved credential ref", () => {
    expect(describeApiTokenForLog('credential("services/x", "token")')).toContain("未解析");
  });
});

describe("formatCloudflareApiFailure", () => {
  it("includes operation, path, and error code", () => {
    const msg = formatCloudflareApiFailure(
      { operation: "创建 Cloudflare Tunnel", method: "POST", path: "/accounts/abc/cfd_tunnel" },
      403,
      [{ code: 10000, message: "Authentication error" }],
      "test-token-value-1234567890",
      "ray-abc",
    );
    expect(msg).toContain("Cloudflare API 失败：创建 Cloudflare Tunnel");
    expect(msg).toContain("POST /accounts/abc/cfd_tunnel");
    expect(msg).toContain("[10000] Authentication error");
    expect(msg).toContain("CF-Ray: ray-abc");
    expect(msg).toContain("排查建议");
    expect(msg).toContain("Cloudflare Tunnel · Edit");
  });

  it("does not treat verify success message as auth failure", () => {
    const msg = formatCloudflareApiFailure(
      { operation: "验证 API Token", method: "GET", path: "/user/tokens/verify" },
      200,
      [{ code: 10000, message: "This API Token is valid and active" }],
      "token",
    );
    expect(msg).not.toContain("AUTHENTICATION_ERROR");
    expect(msg).not.toContain("Bearer Token 未被 Cloudflare 认可");
  });

  it("adds invalid token hints", () => {
    const msg = formatCloudflareApiFailure(
      { operation: "验证 API Token", method: "GET", path: "/user/tokens/verify" },
      401,
      [{ message: "Invalid API Token" }],
      "bad",
    );
    expect(msg).toContain("全局 API 密钥");
  });
});
