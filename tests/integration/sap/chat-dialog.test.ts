import { describe, expect, it } from "bun:test";
import {
  createSapDirectClient,
  mapSapStreamMethodToApi,
  streamEventMethods,
} from "@freeanima/sap-contract";

describe("chat browser SAP client", () => {
  it("sendMessageStream maps stream events to admin shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hello",
    });
    expect(token).toEqual({ event: "token", data: { content: "hello" } });
    expect(streamEventMethods).toContain("stream.done");
  });

  it("createSapDirectClient exposes subscribe and stream helpers", () => {
    const client = createSapDirectClient({
      hubRpcWsUrl: "ws://127.0.0.1:2658/hub/rpc/v1",
    });
    expect(client.getClient()).toBeNull();
    expect(typeof client.subscribeConversationEvents).toBe("function");
    expect(typeof client.sendMessageStream).toBe("function");
    client.stop();
  });
});
