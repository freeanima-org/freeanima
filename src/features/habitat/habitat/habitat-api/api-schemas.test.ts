import { describe, it, expect } from "bun:test";
import {
  createConversationBodySchema,
  sendMessageBodySchema,
  memorySearchBodySchema,
  worldEntityCreateBodySchema,
  subjectEntityCreateBodySchema,
} from "./api/schemas.ts";

describe("api/schemas", () => {
  it("trims and validates send message body", () => {
    const ok = sendMessageBodySchema.safeParse({ message: "  hello  " });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.message).toBe("hello");

    const bad = sendMessageBodySchema.safeParse({ message: "   " });
    expect(bad.success).toBe(false);
  });

  it("validates memory search query", () => {
    const ok = memorySearchBodySchema.safeParse({ query: "  test  ", limit: 5 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.query).toBe("test");
  });

  it("requires platform on create conversation", () => {
    expect(createConversationBodySchema.safeParse({}).success).toBe(false);
    expect(createConversationBodySchema.safeParse({ platform: "remote:chat:test" }).success).toBe(
      true,
    );
  });

  it("validates world entity create body", () => {
    const ok = worldEntityCreateBodySchema.safeParse({
      title: "  My World  ",
      private: false,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.title).toBe("My World");
      expect(ok.data.private).toBe(false);
    }

    const privateOk = worldEntityCreateBodySchema.safeParse({
      title: "Private",
      private: true,
      owner_subject_id: 2,
    });
    expect(privateOk.success).toBe(true);

    const bad = worldEntityCreateBodySchema.safeParse({ title: "   " });
    expect(bad.success).toBe(false);

    const missingOwner = worldEntityCreateBodySchema.safeParse({
      title: "Private",
      private: true,
    });
    expect(missingOwner.success).toBe(false);

    const withStable = worldEntityCreateBodySchema.safeParse({
      title: "Repo world",
      private: false,
      stable_key: "  git:github.com/org/foo  ",
    });
    expect(withStable.success).toBe(true);
    if (withStable.success) expect(withStable.data.stable_key).toBe("git:github.com/org/foo");

    expect(
      worldEntityCreateBodySchema.safeParse({
        title: "Bad key",
        stable_key: "no-prefix",
      }).success,
    ).toBe(false);
  });

  it("validates subject entity create body", () => {
    const ok = subjectEntityCreateBodySchema.safeParse({
      type: "agent",
      title: "Anima",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.type).toBe("agent");
  });
});
