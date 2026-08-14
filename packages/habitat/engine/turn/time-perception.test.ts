import { describe, it, expect } from "bun:test";
import { injectTimePrefixes } from "./time-perception.ts";
import type { StoredMessage, UserMessage } from "@freeanima/habitat/core/db/domain";

//** Build ISO+08 timestamp string */
function ts(isoLocal: string): string {
  return `${isoLocal}.000+08:00`;
}

const WEEKDAY: Record<string, string> = {
  "2026-05-20": "周三",
  "2026-05-21": "周四",
};

function prefixed(content: string, isoLocal: string): string {
  const day = isoLocal.slice(0, 10);
  const weekday = WEEKDAY[day] ?? "";
  return `<time>${isoLocal} ${weekday}</time>\n${content}`;
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

function userContent(msg: StoredMessage | undefined): string | undefined {
  return msg?.role === "user" ? msg.content : undefined;
}

describe("injectTimePrefixes", () => {
  it("adds time prefix to single user message (standalone line)", () => {
    const msgs = [userMsg("morning", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(msgs);
    expect(userContent(result[0])).toBe(prefixed("morning", "2026-05-20T08:02"));
  });

  it("adds prefix to each user message (same-day short gaps)", () => {
    const msgs = [
      userMsg("morning", ts("2026-05-20T08:02:00")),
      assistantMsg("morning ☀️"),
      userMsg("by the way", ts("2026-05-20T08:05:00")),
      userMsg("time to eat", ts("2026-05-20T12:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(userContent(result[0])).toBe(prefixed("morning", "2026-05-20T08:02"));
    expect(userContent(result[2])).toBe(prefixed("by the way", "2026-05-20T08:05"));
    expect(userContent(result[3])).toBe(prefixed("time to eat", "2026-05-20T12:15"));
  });

  it("cross-day messages each have full date-time", () => {
    const msgs = [
      userMsg("good night", ts("2026-05-20T22:30:00")),
      assistantMsg("good night 🌙"),
      userMsg("morning", ts("2026-05-21T09:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(userContent(result[0])).toBe(prefixed("good night", "2026-05-20T22:30"));
    expect(userContent(result[2])).toBe(prefixed("morning", "2026-05-21T09:15"));
  });

  it("skips user messages without timestamp", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "no timestamp" },
      userMsg("has timestamp", ts("2026-05-20T10:00:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(userContent(result[0])).toBe("no timestamp");
    expect(userContent(result[1])).toBe(prefixed("has timestamp", "2026-05-20T10:00"));
  });

  it("skips on malformed timestamp", () => {
    const msgs = [userMsg("bad timestamp", "not-a-date")];
    const result = injectTimePrefixes(msgs);
    expect(userContent(result[0])).toBe("bad timestamp");
  });

  it("assistant / tool messages get no prefix", () => {
    const msgs = [
      systemMsg("You are a digital life"),
      userMsg("hello", ts("2026-05-20T10:00:00")),
      assistantMsg("hello 👋"),
      toolMsg("web_search", '{"q":"test"}'),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]?.role).toBe("system");
    if (result[0]?.role === "system") expect(result[0].content).toBe("You are a digital life");
    expect(userContent(result[1])).toBe(prefixed("hello", "2026-05-20T10:00"));
    expect(result[2]?.role).toBe("assistant");
    if (result[2]?.role === "assistant") expect(result[2].content).toBe("hello 👋");
    expect(result[3]?.role).toBe("tool");
  });

  it("does not mutate original message objects", () => {
    const original: StoredMessage[] = [userMsg("morning", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(original);
    expect(userContent(result[0])).toBe(prefixed("morning", "2026-05-20T08:02"));
    expect(userContent(original[0])).toBe("morning");
    expect(result[0]).not.toBe(original[0]);
  });

  it("empty message list returns empty", () => {
    const result = injectTimePrefixes([]);
    expect(result).toEqual([]);
  });
});
