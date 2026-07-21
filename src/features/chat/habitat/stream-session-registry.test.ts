import { afterEach, describe, expect, it } from "bun:test";

import { STREAM_SESSION_DONE_TTL_MS, streamSessionRegistry } from "./stream-session-registry.ts";

describe("stream-session-registry", () => {
  afterEach(() => {
    streamSessionRegistry.resetForTests();
  });

  it("opens session and maps client_op_id", () => {
    streamSessionRegistry.openSession("s1", "c1", { client_op_id: "op-1" });
    expect(streamSessionRegistry.getSession("s1")?.conversation_id).toBe("c1");
    expect(streamSessionRegistry.findByClientOpId("op-1")?.stream_id).toBe("s1");
    expect(STREAM_SESSION_DONE_TTL_MS).toBe(600_000);
  });

  it("appends tokens and overwrites on content_replace", () => {
    streamSessionRegistry.openSession("s1", "c1");
    streamSessionRegistry.applyAndPublish("stream.token", {
      stream_id: "s1",
      content: "Hello",
    });
    streamSessionRegistry.applyAndPublish("stream.token", {
      stream_id: "s1",
      content: " world",
    });
    expect(streamSessionRegistry.getSession("s1")?.answer_text).toBe("Hello world");

    streamSessionRegistry.applyAndPublish("stream.content_replace", {
      stream_id: "s1",
      content: "final",
    });
    expect(streamSessionRegistry.getSession("s1")?.answer_text).toBe("final");
  });

  it("fans out to subscribers and clears answer on assistant display_append", () => {
    streamSessionRegistry.openSession("s1", "c1");
    const events: Array<{ method: string; payload: Record<string, unknown> }> = [];
    const unsub = streamSessionRegistry.subscribe("s1", (method, payload) => {
      events.push({ method, payload });
    });
    expect(unsub).not.toBeNull();

    streamSessionRegistry.applyAndPublish("stream.token", {
      stream_id: "s1",
      content: "partial",
    });
    streamSessionRegistry.applyAndPublish("stream.display_append", {
      stream_id: "s1",
      item: { type: "message", role: "assistant", content: "partial" },
    });

    expect(events.map((e) => e.method)).toEqual(["stream.token", "stream.display_append"]);
    expect(streamSessionRegistry.getSession("s1")?.answer_text).toBe("");
    expect(streamSessionRegistry.getSession("s1")?.display_items).toHaveLength(1);
    unsub?.();
  });

  it("replaySnapshot dumps buffer then terminal", () => {
    streamSessionRegistry.openSession("s1", "c1");
    streamSessionRegistry.applyAndPublish("stream.token", {
      stream_id: "s1",
      content: "hi",
    });
    streamSessionRegistry.applyAndPublish("stream.done", { stream_id: "s1" });

    const replayed: string[] = [];
    streamSessionRegistry.replaySnapshot("s1", (method) => {
      replayed.push(method);
    });
    expect(replayed).toEqual(["stream.accepted", "stream.content_replace", "stream.done"]);
    expect(streamSessionRegistry.getSession("s1")?.status).toBe("done");
  });

  it("subscribe returns null for unknown stream", () => {
    expect(streamSessionRegistry.subscribe("missing", () => {})).toBeNull();
  });

  it("indexes active stream by conversation_id", () => {
    streamSessionRegistry.openSession("s1", "c1");
    expect(streamSessionRegistry.findByConversationId("c1")?.stream_id).toBe("s1");
    streamSessionRegistry.openSession("s2", "c1");
    expect(streamSessionRegistry.findByConversationId("c1")?.stream_id).toBe("s2");
    streamSessionRegistry.deleteSession("s2");
    expect(streamSessionRegistry.findByConversationId("c1")).toBeNull();
  });
});
