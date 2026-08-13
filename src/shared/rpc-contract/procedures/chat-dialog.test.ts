import { describe, expect, it } from "bun:test";
import { mapSapStreamMethodToApi, streamEventMethods } from "@freeanima/shared/rpc-contract";
import { getBundledRpcStreamClient } from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";

describe("chat browser SAP client", () => {
  it("sendMessageStream maps stream events to console shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hello",
    });
    expect(token).toEqual({ event: "token", data: { content: "hello" } });
    expect(streamEventMethods).toContain("stream.done");
  });

  it("getBundledRpcStreamClient exposes subscribe and stream helpers", () => {
    const client = getBundledRpcStreamClient({
      habitatRpcWsUrl: "ws://127.0.0.1:2658/rpc/v1",
    });
    expect(client.getClient()).toBeNull();
    expect(typeof client.subscribeConversationEvents).toBe("function");
    expect(typeof client.sendMessageStream).toBe("function");
    client.stop();
  });
});
