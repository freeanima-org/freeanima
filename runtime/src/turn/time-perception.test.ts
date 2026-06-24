import { describe, it, expect } from "bun:test";
import { injectTimePrefixes } from "./time-perception.ts";
import type { StoredMessage, UserMessage } from "@freeanima/core/db/domain";

//** Build ISO+08 timestamp string */
function ts(isoLocal: string): string {
  return `${isoLocal}.000+08:00`;
}

function prefixed(content: string, isoLocal: string): string {
  return `time: ${isoLocal}\n${content}`;
}

function userMsg(content: string, timestamp: string): UserMessage {
  return { role: "user", content, timestamp };
}

function assistantMsg(content: string): StoredMessage {
  return { role: "assistant", content };
}

function toolMsg(name: string, content: string): StoredMessage {
  return { role: "tool", tool_call_id: "tc1", name, content };
}

function systemMsg(content: string): StoredMessage {
  return { role: "system", content };
}

describe("injectTimePrefixes", () => {
  it("adds time prefix to single user message (standalone line)", () => {
    const msgs = [userMsg("morning", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("morning", "2026-05-20T08:02"),
    );
  });

  it("adds prefix to each user message (same-day short gaps)", () => {
    const msgs = [
      userMsg("morning", ts("2026-05-20T08:02:00")),
      assistantMsg("morning ☀️"),
      userMsg("by the way", ts("2026-05-20T08:05:00")),
      userMsg("time to eat", ts("2026-05-20T12:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("morning", "2026-05-20T08:02"),
    );
    expect(result[2]!.role === "user" && result[2].content).toBe(
      prefixed("by the way", "2026-05-20T08:05"),
    );
    expect(result[3]!.role === "user" && result[3].content).toBe(
      prefixed("time to eat", "2026-05-20T12:15"),
    );
  });

  it("cross-day messages each have full date-time", () => {
    const msgs = [
      userMsg("good night", ts("2026-05-20T22:30:00")),
      assistantMsg("good night 🌙"),
      userMsg("morning", ts("2026-05-21T09:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("good night", "2026-05-20T22:30"),
    );
    expect(result[2]!.role === "user" && result[2].content).toBe(
      prefixed("morning", "2026-05-21T09:15"),
    );
  });

  it("skips user messages without timestamp", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "no timestamp" },
      userMsg("has timestamp", ts("2026-05-20T10:00:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("no timestamp");
    expect(result[1]!.role === "user" && result[1].content).toBe(
      prefixed("has timestamp", "2026-05-20T10:00"),
    );
  });

  it("skips on malformed timestamp", () => {
    const msgs = [userMsg("bad timestamp", "not-a-date")];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("bad timestamp");
  });

  it("assistant / tool messages get no prefix", () => {
    const msgs = [
      systemMsg("You are a digital life"),
      userMsg("hello", ts("2026-05-20T10:00:00")),
      assistantMsg("hello 👋"),
      toolMsg("web_search", '{"q":"test"}'),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "system" && result[0].content).toBe("You are a digital life");
    expect(result[1]!.role === "user" && result[1].content).toBe(
      prefixed("hello", "2026-05-20T10:00"),
    );
    expect(result[2]!.role === "assistant" && result[2].content).toBe("hello 👋");
    expect(result[3]!.role).toBe("tool");
  });

  it("does not mutate original message objects", () => {
    const original: StoredMessage[] = [userMsg("morning", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(original);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("morning", "2026-05-20T08:02"),
    );
    expect(original[0]!.role === "user" && original[0].content).toBe("morning");
    expect(result[0]).not.toBe(original[0]);
  });

  it("empty message list returns empty", () => {
    const result = injectTimePrefixes([]);
    expect(result).toEqual([]);
  });
});
