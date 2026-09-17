import { findExistingLogin, needsPasswordUpdate } from "./login-match.ts";

describe("findExistingLogin", () => {
  const items = [
    {
      id: 1,
      item_type: "login" as const,
      title: "Example",
      url: "https://example.com/login",
      username: "alice",
    },
    {
      id: 2,
      item_type: "login" as const,
      title: "Other",
      uris: [{ uri: "https://other.com/", match: "domain" as const }],
      username: "bob",
    },
    {
      id: 3,
      item_type: "secure_note" as const,
      title: "Note",
      url: "https://example.com/login",
      username: "alice",
    },
    {
      id: 4,
      item_type: "login" as const,
      title: "GitHub",
      url: "https://github.com",
      username: "carol",
    },
  ];

  test("matches url + username", () => {
    expect(findExistingLogin(items, "https://example.com/login", "alice")?.id).toBe(1);
  });

  test("matches uris entry", () => {
    expect(findExistingLogin(items, "https://other.com/", "bob")?.id).toBe(2);
  });

  test("matches domain when page path differs", () => {
    expect(findExistingLogin(items, "https://other.com/login", "bob")?.id).toBe(2);
    expect(findExistingLogin(items, "https://github.com/login", "carol")?.id).toBe(4);
  });

  test("ignores non-login", () => {
    expect(findExistingLogin(items, "https://example.com/login", "carol")).toBeUndefined();
  });

  test("requires same username", () => {
    expect(findExistingLogin(items, "https://example.com/login", "bob")).toBeUndefined();
    expect(findExistingLogin(items, "https://github.com/login", "alice")).toBeUndefined();
  });
});

describe("needsPasswordUpdate", () => {
  test("无库内密码 → false（保守）", () => {
    expect(needsPasswordUpdate(undefined, "new")).toBe(false);
  });

  test("相同 → false", () => {
    expect(needsPasswordUpdate("same", "same")).toBe(false);
  });

  test("不同 → true", () => {
    expect(needsPasswordUpdate("old", "new")).toBe(true);
  });
});
