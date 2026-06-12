import { describe, it, expect } from "bun:test";
import { cronJobDataSchema } from "@freeanima/platform/connectors/cron";
import {
  eventPayloadSchemas,
  sessionUpdatedPayloadSchema,
} from "@freeanima/capabilities-memory/schemas/event-payloads";
import { factExtractionSchema } from "@freeanima/capabilities-memory/schemas/fact-extraction";
import { filterRecallableMessages } from "@freeanima/capabilities-memory";
import { toolArgsSchema, toolErrorSchema } from "@freeanima/core/tool";
import { parseCompressionState, clarifyToolAwaitingResultSchema } from "@freeanima/core/db/domain";
import { jsonRpcMessageSchema } from "@freeanima/capabilities-acp/schemas/acp-jsonrpc";
import {
  weixinContextTokensSchema,
  weixinSyncSchema,
} from "@freeanima/platform/connectors/gateway/schemas/weixin";

describe("schemas/cron", () => {
  it("parses minimal cron job", () => {
    const result = cronJobDataSchema.safeParse({
      id: "j1",
      name: "test",
      schedule: "0 * * * *",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deliver).toBe("local");
    expect(result.data.timeout_sec).toBe(300);
  });
});

describe("schemas/events", () => {
  it("validates session:updated payload", () => {
    const result = sessionUpdatedPayloadSchema.safeParse({ session_id: "s1", extra: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing session_id", () => {
    const result = eventPayloadSchemas["session:updated"].safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("schemas/fact-extraction", () => {
  it("filterRecallableMessages keeps user messages", () => {
    const filtered = filterRecallableMessages([
      { role: "user", content: "hi", pos: 1, timestamp: "t" },
      { role: "tool", tool_call_id: "x", content: "{}", pos: 2, timestamp: "t" },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.content).toBe("hi");
  });

  it("parses fact extraction JSON", () => {
    const result = factExtractionSchema.safeParse({
      facts: [{ content: "Alice prefers direct communication" }],
      summary: "preference",
    });
    expect(result.success).toBe(true);
  });
});

describe("schemas/tool-json", () => {
  it("detects tool error", () => {
    expect(toolErrorSchema.safeParse({ error: "bad" }).success).toBe(true);
    expect(toolErrorSchema.safeParse({ error: "" }).success).toBe(false);
  });

  it("requires object tool args", () => {
    expect(toolArgsSchema.safeParse({ a: 1 }).success).toBe(true);
    expect(toolArgsSchema.safeParse([]).success).toBe(false);
  });
});

describe("schemas/session-meta compression", () => {
  it("parses l2/l3 compression state", () => {
    const s = parseCompressionState({ l2: 3, l3: 5 });
    expect(s).toEqual({ l2: 3, l3: 5 });
  });
});

describe("schemas/clarify tool result", () => {
  it("parses awaiting clarify tool output", () => {
    const result = clarifyToolAwaitingResultSchema.safeParse({
      status: "awaiting",
      items: [{ question: "Which one?" }],
      timeout_sec: 120,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ status: "awaiting", timeout_sec: 120 });
  });
});

describe("integrations schemas", () => {
  it("parses jsonrpc message loosely", () => {
    const result = jsonRpcMessageSchema.safeParse({
      jsonrpc: "2.0",
      method: "ping",
      id: 1,
    });
    expect(result.success).toBe(true);
  });

  it("parses weixin sync state", () => {
    expect(weixinSyncSchema.safeParse({ sync_buf: "abc" }).success).toBe(true);
  });

  it("parses weixin context tokens", () => {
    const result = weixinContextTokensSchema.safeParse({ peer1: "tok1" });
    expect(result.success).toBe(true);
  });
});
