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
  conversationCommandsInputSchema,
  toolRegisterInputSchema,
} from "@freeanima/sap-contract";

describe("sap-contract envelopes", () => {
  it("round-trips req/res frames", () => {
    const frame = {
      kind: "req" as const,
      id: "abc",
      method: "conversation.create",
      payload: { platform: "sap:chat:k7m" },
    };
    const parsed = parseSapEnvelope(serializeSapEnvelope(frame));
    expect(parsed).toEqual(frame);
  });

  it("validates connect payload with http_url", () => {
    const payload = connectPayloadSchema.parse({
      app_id: "chat",
      instance_id: "k7m",
      protocol: "SAP/1.0",
      features_requested: [],
      http_url: "http://127.0.0.1:4174",
    });
    expect(payload.http_url).toBe("http://127.0.0.1:4174");
  });

  it("validates chat SAP procedure schemas", () => {
    sessionAcpDockInputSchema.parse({ conversation_id: "sid" });
    conversationCommandsInputSchema.parse({ platform: "sap:chat:k7m" });
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
    messageSendInputSchema.parse({ conversation_id: "s1", message: "hi" });
  });

  it("formats sap tool names", () => {
    expect(formatSapToolName("pair-programming", "k7m", "scan_code")).toBe(
      "sap_pairprogramming_k7m_scan_code",
    );
  });

  it("validates connected capability_mask presets shape", () => {
    const parsed = connectedPayloadSchema.parse({
      protocol: "SAP/1.0",
      instance_id: "k7m",
      features_enabled: ["capability_mask"],
      server_info: {
        anima_version: "0.5.0",
        sap_version: "SAP/1.0",
        capability_mask: {
          presets: [{ name: "developer", allowed_tools_summary: ["file_read"] }],
        },
      },
      heartbeat_interval_sec: 30,
    });
    expect(parsed.server_info?.capability_mask?.presets[0]?.name).toBe("developer");
  });

  it("maps sap stream events to admin sse shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hi",
    });
    expect(token).toEqual({ event: "token", data: { content: "hi" } });
  });
});
