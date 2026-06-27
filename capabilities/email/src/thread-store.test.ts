import { describe, expect, test } from "bun:test";

import { deriveThreadKey, normalizeEmailSubject } from "./thread-store.ts";

describe("email thread helpers", () => {
  test("normalizeEmailSubject strips Re/Fwd", () => {
    expect(normalizeEmailSubject("Re: Hello")).toBe("hello");
    expect(normalizeEmailSubject("Fwd: Plan")).toBe("plan");
  });

  test("deriveThreadKey prefers references", () => {
    expect(
      deriveThreadKey({
        references: ["<root@example.com>"],
        subject: "Re: Hello",
      }),
    ).toBe("<root@example.com>");
  });

  test("deriveThreadKey falls back to subject hash", () => {
    expect(deriveThreadKey({ subject: "Hello" })).toBe("subject:hello");
  });
});
