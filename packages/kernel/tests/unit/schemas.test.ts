import { describe, it, expect } from "bun:test";
import { cronJobDataSchema } from "../../src/schemas/cron";
import {
  eventPayloadSchemas,
  sessionUpdatedPayloadSchema,
} from "../../src/schemas/events";
import { l2LineSchema, factExtractionSchema } from "../../src/schemas/l2";
import { toolArgsSchema, toolErrorSchema } from "../../src/schemas/tool-json";
import {
  createSessionBodySchema,
  sendMessageBodySchema,
  memorySearchBodySchema,
} from "../../../api/src/schemas";
import { parseCompressionState, clarifyToolAwaitingResultSchema } from "../../src/schemas/session-meta";
import { jsonRpcMessageSchema } from "../../../integrations/src/schemas/acp-jsonrpc";
import {
  weixinSyncSchema,
  weixinContextTokensSchema,
} from "../../../gateway/src/schemas/weixin";

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

describe("schemas/l2", () => {
  it("parses l2 line with passthrough", () => {
    const result = l2LineSchema.safeParse({
      role: "user",
      content: "hi",
      custom: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.custom).toBe(true);
  });

  it("parses fact extraction JSON", () => {
    const result = factExtractionSchema.safeParse({
      facts: [{ content: "张三偏好直接沟通" }],
      summary: "偏好",
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

describe("schemas/api", () => {
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

  it("accepts optional platform on create session", () => {
    expect(createSessionBodySchema.safeParse({}).success).toBe(true);
    expect(createSessionBodySchema.safeParse({ platform: "parlor" }).success).toBe(true);
  });
});

describe("schemas/session-meta compression", () => {
  it("migrates legacy cut_id fields", () => {
    const s = parseCompressionState({ cut_id: 5, last_summarized_cut_id: 3 });
    expect(s).toEqual({ l2: 3, l3: 5 });
  });
});

describe("schemas/clarify tool result", () => {
  it("parses awaiting clarify tool output", () => {
    const result = clarifyToolAwaitingResultSchema.safeParse({
      status: "awaiting",
      items: [{ question: "选哪个？" }],
      timeout_sec: 120,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ status: "awaiting", timeout_sec: 120 });
  });
});

describe("schemas/message", () => {
  it("parseSessionLine 接受 pos", async () => {
    const { parseSessionLine } = await import("../../src/schemas/message");
    const parsed = parseSessionLine(
      JSON.stringify({ role: "user", content: "hi", pos: 3, timestamp: "t" }),
    );
    expect(parsed?.role).toBe("user");
    if (parsed?.role !== "user") return;
    expect(parsed.pos).toBe(3);
  });

  it("parseSessionLine 将 legacy id 映射为 pos", async () => {
    const { parseSessionLine } = await import("../../src/schemas/message");
    const parsed = parseSessionLine(
      JSON.stringify({ role: "user", content: "hi", id: 5, timestamp: "t" }),
    );
    expect(parsed?.role).toBe("user");
    if (parsed?.role !== "user") return;
    expect(parsed.pos).toBe(5);
    expect("id" in parsed).toBe(false);
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
