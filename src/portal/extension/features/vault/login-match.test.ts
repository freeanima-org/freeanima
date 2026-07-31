import { findExistingLogin } from "./login-match.ts";

describe("findExistingLogin", () => {
  const items = [
    {
      id: 1,
      item_type: "login" as const,
      url: "https://example.com/login",
      username: "alice",
    },
    {
      id: 2,
      item_type: "login" as const,
      uris: [{ uri: "https://other.com/", match: "domain" as const }],
      username: "bob",
    },
    {
      id: 3,
      item_type: "secure_note" as const,
      url: "https://example.com/login",
      username: "alice",
    },
  ];

  test("matches url + username", () => {
    expect(findExistingLogin(items, "https://example.com/login", "alice")?.id).toBe(1);
  });

  test("matches uris entry", () => {
    expect(findExistingLogin(items, "https://other.com/", "bob")?.id).toBe(2);
  });

  test("ignores non-login", () => {
    expect(findExistingLogin(items, "https://example.com/login", "carol")).toBeUndefined();
  });

  test("requires same username", () => {
    expect(findExistingLogin(items, "https://example.com/login", "bob")).toBeUndefined();
  });
});
