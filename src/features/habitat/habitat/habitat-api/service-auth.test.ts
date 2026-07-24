import { describe, expect, mock, test } from "bun:test";

import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";

const verifyServiceApiToken = mock(
  async (_raw: string): Promise<VerifiedServiceApiToken | null> => null,
);

mock.module("@freeanima/host/core/db/pg/service-api-token", () => ({
  verifyServiceApiToken,
}));

const { evaluateServiceAuthAuthed } = await import("./service-auth.ts");

describe("evaluateServiceAuthAuthed", () => {
  test("health.probe 带 Bearer 仍校验 token", async () => {
    verifyServiceApiToken.mockReset();
    verifyServiceApiToken.mockResolvedValueOnce({
      token_id: 1,
      subject_id: 53,
      subject_type: "user",
      scopes: ["full"],
    });

    const req = new Request("http://127.0.0.1:2658/rpc/v1/health/probe", {
      headers: { Authorization: "Bearer fa_at_testprefix_testsecret" },
    });

    await expect(evaluateServiceAuthAuthed(req)).resolves.toBe(true);
    expect(verifyServiceApiToken).toHaveBeenCalledWith("fa_at_testprefix_testsecret");
  });

  test("无 Bearer 返回 false", async () => {
    verifyServiceApiToken.mockReset();
    const req = new Request("http://127.0.0.1:2658/rpc/v1/health/probe");
    await expect(evaluateServiceAuthAuthed(req)).resolves.toBe(false);
    expect(verifyServiceApiToken).not.toHaveBeenCalled();
  });
});
