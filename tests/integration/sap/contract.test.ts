import { describe, expect, it } from "bun:test";
import {
  connectPayloadSchema,
  formatSapToolName,
  mapSapStreamMethodToApi,
  messageSendInputSchema,
  parseSapEnvelope,
  serializeSapEnvelope,
  toolRegisterInputSchema,
} from "@freeanima/sap-contract";

describe("sap-contract envelopes", () => {
  it("round-trips req/res frames", () => {
    const frame = {
      kind: "req" as const,
      id: "abc",
      method: "session.create",
      payload: { platform: "parlor" },
    };
    const parsed = parseSapEnvelope(serializeSapEnvelope(frame));
    expect(parsed).toEqual(frame);
  });

  it("validates connect payload with http_url", () => {
    const payload = connectPayloadSchema.parse({
      app_id: "pair-programming",
      instance_id: "550e8400-e29b-41d4-a716-446655440000",
      protocol: "SAP/1.0",
      features_requested: [],
      http_url: "http://127.0.0.1:4173",
    });
    expect(payload.http_url).toBe("http://127.0.0.1:4173");
  });

  it("validates tool register and message send", () => {
    toolRegisterInputSchema.parse({
      tools: [
        {
          local_name: "scan_code",
          description: "scan",
          parameters: { type: "object", properties: {} },
          return_kind: "text",
        },
      ],
    });
    messageSendInputSchema.parse({ session_id: "s1", message: "hi" });
  });

  it("formats sap tool names", () => {
    expect(
      formatSapToolName("pair-programming", "550e8400-e29b-41d4-a716-446655440000", "scan_code"),
    ).toBe("sap_pairprogramming_550e8400e29b41d4a716446655440000_scan_code");
  });

  it("maps sap stream events to webui sse shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hi",
    });
    expect(token).toEqual({ event: "token", data: { content: "hi" } });
  });
});
