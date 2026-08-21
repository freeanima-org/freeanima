import { describe, expect, test } from "bun:test";

import {
  normalizeContactChannelValue,
  contactAddressEntrySchema,
  contactBodySchema,
} from "@freeanima/habitat/core/db/schema/entity/components/contact.ts";
import { extractEmailAddress, extractMailboxDisplayName } from "./contact-store.ts";

describe("contact channel normalize", () => {
  test("email lowercases", () => {
    expect(normalizeContactChannelValue("email", "  Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  test("phone strips spaces", () => {
    expect(normalizeContactChannelValue("phone", "138 0000 1111")).toBe("13800001111");
  });
});

describe("extractEmailAddress", () => {
  test("parses angle form", () => {
    expect(extractEmailAddress("灼华 <Zhuohua@example.com>")).toBe("zhuohua@example.com");
  });

  test("parses bare address", () => {
    expect(extractEmailAddress("a@b.com")).toBe("a@b.com");
  });

  test("rejects non-email", () => {
    expect(extractEmailAddress("not-an-email")).toBeNull();
  });
});

describe("extractMailboxDisplayName", () => {
  test("parses display name before angle", () => {
    expect(extractMailboxDisplayName("灼华 <zhuohua@example.com>")).toBe("灼华");
  });

  test("bare address has no display name", () => {
    expect(extractMailboxDisplayName("a@b.com")).toBeNull();
  });
});

describe("contact body schema", () => {
  test("rejects address identity_key", () => {
    const parsed = contactAddressEntrySchema.safeParse({
      value: "某市某路",
      identity_key: true,
    });
    expect(parsed.success).toBe(false);
  });

  test("accepts emails with identity_key", () => {
    const parsed = contactBodySchema.safeParse({
      emails: [{ value: "a@b.com", identity_key: true }],
    });
    expect(parsed.success).toBe(true);
  });
});
