import { describe, expect, it } from "bun:test";
import {
  connectPayloadSchema,
  connectedPayloadSchema,
  formatSapToolName,
  fridgeListInputSchema,
  mapSapStreamMethodToApi,
  messageSendInputSchema,
  parseSapEnvelope,
  serializeSapEnvelope,
  sessionAcpDockInputSchema,
  sessionCommandsInputSchema,
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
      app_id: "parlor",
      instance_id: "550e8400-e29b-41d4-a716-446655440000",
      protocol: "SAP/1.0",
      features_requested: [],
      http_url: "http://127.0.0.1:4174",
    });
    expect(payload.http_url).toBe("http://127.0.0.1:4174");
  });

  it("validates parlor SAP procedure schemas", () => {
    sessionAcpDockInputSchema.parse({ session_id: "sid" });
    sessionCommandsInputSchema.parse({ platform: "parlor" });
    fridgeListInputSchema.parse({});
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

  it("validates connected capability_mask presets shape", () => {
    const parsed = connectedPayloadSchema.parse({
      protocol: "SAP/1.0",
      features_enabled: ["capability_mask"],
      server_info: {
        anima_version: "0.5.0",
        sap_version: "SAP/1.0",
        platform_for_app: { parlor: "parlor" },
        capability_mask: {
          presets: [{ name: "developer", allowed_tools_summary: ["file_read"] }],
        },
      },
      heartbeat_interval_sec: 30,
    });
    expect(parsed.server_info?.capability_mask?.presets[0]?.name).toBe("developer");
  });

  it("maps sap stream events to webui sse shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hi",
    });
    expect(token).toEqual({ event: "token", data: { content: "hi" } });
  });
});
