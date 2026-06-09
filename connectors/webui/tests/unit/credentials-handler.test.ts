import { describe, it, expect } from "bun:test";
import { getCredentialDetailHandler } from "../../src/handlers/credentials.ts";
import { ApiHandlerError } from "../../src/handlers/errors.ts";

describe("credentials handler", () => {
  it("未知路径 getCredentialDetailHandler 抛出 404", () => {
    try {
      getCredentialDetailHandler("__nonexistent_credential_path__");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHandlerError);
      expect((err as ApiHandlerError).status).toBe(404);
    }
  });
});
