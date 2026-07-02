import { describe, it, expect } from "bun:test";
import { getCredentialDetailHandler } from "./handlers/credentials.ts";

describe("credentials handler", () => {
  it("getCredentialDetailHandler 已下线", () => {
    expect(() => getCredentialDetailHandler("any")).toThrow(/pass credentials removed/);
  });
});
