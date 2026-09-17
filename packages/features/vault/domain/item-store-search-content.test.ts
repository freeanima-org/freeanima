import { describe, expect, test } from "bun:test";

import { buildVaultItemSearchContent } from "./item-store.ts";

describe("buildVaultItemSearchContent", () => {
  test("拼接 username、url、uris，跳过与 url 重复的 uri", () => {
    expect(
      buildVaultItemSearchContent({
        username: "alice",
        url: "https://a.example",
        uris: [
          { uri: "https://a.example", match: "domain" },
          { uri: "https://b.example", match: "host" },
        ],
      }),
    ).toBe("alice\nhttps://a.example\nhttps://b.example");
  });

  test("extra 前置；空字段忽略", () => {
    expect(
      buildVaultItemSearchContent({
        extra: "  note blob  ",
        username: "  ",
        uris: [{ uri: "https://only.example", match: "exact" }],
      }),
    ).toBe("note blob\nhttps://only.example");
  });
});
