import { describe, expect, it } from "bun:test";

import {
  mapRuntimeStreamEventToSap,
  messageSendInputSchema,
  streamAttachInputSchema,
  streamAttachOutputSchema,
  streamLookupInputSchema,
  streamLookupOutputSchema,
} from "./message.ts";

describe("message stream llm_debug", () => {
  it("accepts llm_debug on message.send input", () => {
    const parsed = messageSendInputSchema.parse({
      conversation_id: "c1",
      message: "hi",
      llm_debug: true,
    });
    expect(parsed.llm_debug).toBe(true);
  });

  it("parses stream.attach schemas", () => {
    expect(streamAttachInputSchema.parse({ stream_id: "sid-1" }).stream_id).toBe("sid-1");
    expect(streamAttachOutputSchema.parse({ status: "active", replayed: true })).toEqual({
      status: "active",
      replayed: true,
    });
  });

  it("parses stream.lookup schemas", () => {
    expect(streamLookupInputSchema.parse({ conversation_id: "c1" }).conversation_id).toBe("c1");
    expect(streamLookupOutputSchema.parse({})).toEqual({});
    expect(streamLookupOutputSchema.parse({ stream_id: "s1", status: "active" })).toEqual({
      stream_id: "s1",
      status: "active",
    });
  });

  it("maps runtime llm_debug to SAP stream event", () => {
    const mapped = mapRuntimeStreamEventToSap("sid-1", {
      event: "llm_debug",
      data: {
        phase: "initial",
        turn_index: 0,
        model: "m",
        tool_count: 0,
        tools: [],
        invoke: { turns: [{ role: "user", content: "hi" }] },
      },
    });
    expect(mapped?.method).toBe("stream.llm_debug");
    expect(mapped?.payload.stream_id).toBe("sid-1");
    expect(mapped?.payload.phase).toBe("initial");
  });

  it("accepts attachment-only message.send", () => {
    const parsed = messageSendInputSchema.parse({
      conversation_id: "c1",
      message: "",
      attachment_temp_ids: ["tmp-1"],
      attachments: [{ filename: "a.png", mime_type: "image/png", size: 12 }],
    });
    expect(parsed.attachment_temp_ids).toEqual(["tmp-1"]);
  });

  it("rejects empty message without attachments", () => {
    expect(() => messageSendInputSchema.parse({ conversation_id: "c1", message: "   " })).toThrow();
  });
});
