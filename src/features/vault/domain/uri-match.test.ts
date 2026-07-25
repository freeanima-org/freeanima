import { describe, expect, test } from "bun:test";

import { matchVaultItemsForUrl, scoreUriMatch } from "./uri-match.ts";

describe("scoreUriMatch", () => {
  test("domain 匹配同注册域与子域", () => {
    expect(
      scoreUriMatch("https://app.github.com/login", "https://github.com", "domain"),
    ).toBeGreaterThan(0);
    expect(scoreUriMatch("https://evil.com", "https://github.com", "domain")).toBe(0);
  });

  test("host 要求主机名全等（去 www）", () => {
    expect(scoreUriMatch("https://www.example.com/a", "https://example.com", "host")).toBe(90);
    expect(scoreUriMatch("https://app.example.com", "https://example.com", "host")).toBe(0);
  });

  test("exact / starts_with / never", () => {
    expect(scoreUriMatch("https://example.com/path", "https://example.com/path", "exact")).toBe(
      100,
    );
    expect(
      scoreUriMatch("https://example.com/path/extra", "https://example.com/path", "starts_with"),
    ).toBe(80);
    expect(scoreUriMatch("https://example.com", "https://example.com", "never")).toBe(0);
  });
});

describe("matchVaultItemsForUrl", () => {
  test("优先 uris；无 uris 时回退 url；按分数排序", () => {
    const ranked = matchVaultItemsForUrl("https://mail.google.com/inbox", [
      { id: 1, url: "https://github.com" },
      {
        id: 2,
        uris: [
          { uri: "https://accounts.google.com", match: "domain" },
          { uri: "https://mail.google.com", match: "host" },
        ],
      },
      { id: 3, url: "https://google.com" },
    ]);
    expect(ranked.map((r) => r.id)).toEqual([2, 3]);
    expect(ranked[0]?.match).toBe("host");
  });
});
