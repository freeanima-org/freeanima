import { describe, expect, it } from "bun:test";
import {
  createSapBrowserClient,
  mapSapStreamMethodToApi,
  streamEventMethods,
} from "@freeanima/sap-contract";

describe("parlor browser SAP client", () => {
  it("sendMessageStream maps stream events to webui shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hello",
    });
    expect(token).toEqual({ event: "token", data: { content: "hello" } });
    expect(streamEventMethods).toContain("stream.done");
  });

  it("createSapBrowserClient exposes subscribe and stream helpers", () => {
    const client = createSapBrowserClient({
      hubWsUrl: "ws://127.0.0.1:2658/sap/v1",
      httpUrl: "http://127.0.0.1:4174",
    });
    expect(client.getClient()).toBeNull();
    expect(typeof client.subscribeSessionEvents).toBe("function");
    expect(typeof client.sendMessageStream).toBe("function");
    client.stop();
  });
});
