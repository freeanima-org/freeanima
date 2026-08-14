import { describe, it, expect } from "bun:test";
import {
  createConversationBodySchema,
  sendMessageBodySchema,
  passiveRecallDebugBodySchema,
  temporalSummaryListBodySchema,
  temporalSummaryRegenerateBodySchema,
  temporalSummaryBackfillMissingBodySchema,
  temporalSummaryRebuildRangeBodySchema,
  temporalSystemRollRegenerateBodySchema,
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

  it("validates passive recall debug body", () => {
    const ok = passiveRecallDebugBodySchema.safeParse({ user_text: "  test  ", limit: 5 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.user_text).toBe("test");
  });

  it("validates temporal summary list body", () => {
    const ok = temporalSummaryListBodySchema.safeParse({
      window: "day",
      offset: 0,
      limit: 20,
    });
    expect(ok.success).toBe(true);
  });

  it("validates temporal regenerate and system roll bodies", () => {
    expect(
      temporalSummaryRegenerateBodySchema.safeParse({
        window: "month",
        period_start: "2026-01-01",
      }).success,
    ).toBe(true);
    expect(
      temporalSummaryRegenerateBodySchema.safeParse({
        window: "day",
        period_start: "bad",
      }).success,
    ).toBe(false);
    expect(temporalSystemRollRegenerateBodySchema.safeParse({ kind: "past_days" }).success).toBe(
      true,
    );
    expect(temporalSystemRollRegenerateBodySchema.safeParse({ kind: "near7" }).success).toBe(false);
  });

  it("validates temporal backfill missing body", () => {
    expect(
      temporalSummaryBackfillMissingBodySchema.safeParse({
        window: "day",
        period_start_from: "2026-01-01",
        period_start_to: "2026-01-31",
      }).success,
    ).toBe(true);
    expect(
      temporalSummaryBackfillMissingBodySchema.safeParse({
        window: "day",
        period_start_from: "2026-01",
        period_start_to: "2026-01-31",
      }).success,
    ).toBe(false);
  });

  it("validates temporal rebuild range body", () => {
    expect(
      temporalSummaryRebuildRangeBodySchema.safeParse({
        window: "month",
        period_start_from: "2026-01-01",
        period_start_to: "2026-03-01",
      }).success,
    ).toBe(true);
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
