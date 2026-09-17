import { describe, expect, it } from "bun:test";
import { ProviderError } from "./errors.ts";
import { MockBackend } from "./test-helpers/mock-backend.ts";

describe("MockBackend", () => {
  it("listModels returns default catalog entry", async () => {
    const backend = new MockBackend();
    const models = await backend.listModels({});
    expect(models).toHaveLength(1);
    expect(models[0]?.model).toBe("test-model");
  });

  it("getModel returns null for missing sentinel", async () => {
    const backend = new MockBackend();
    expect(await backend.getModel("__missing__", {})).toBeNull();
    expect(await backend.getModel("custom", {})).toMatchObject({ model: "custom" });
  });

  it("mapError passes through ProviderError", () => {
    const backend = new MockBackend();
    const err = new ProviderError("x", "timeout", true);
    expect(backend.mapError(err, {})).toBe(err);
  });

  it("mapError wraps unknown errors with providerId", () => {
    const backend = new MockBackend();
    const mapped = backend.mapError("boom", {}, { providerId: "p1" });
    expect(mapped).toBeInstanceOf(ProviderError);
    expect(mapped.providerId).toBe("p1");
  });

  it("chatStream uses default events when streamEvents omitted", async () => {
    const backend = new MockBackend();
    const events = [];
    for await (const ev of backend.chatStream("m", { messages: [], params: {} }, {})) {
      events.push(ev);
    }
    expect(events).toEqual([
      { type: "content", content: "chunk" },
      { type: "done", model: "test-model", finish_reason: "stop" },
    ]);
  });

  it("chatStream throws streamError when configured", async () => {
    const backend = new MockBackend({ streamError: new Error("stream fail") });
    await expect(async () => {
      for await (const _ of backend.chatStream("m", { messages: [], params: {} }, {})) {
        /* drain */
      }
    }).toThrow("stream fail");
  });
});
