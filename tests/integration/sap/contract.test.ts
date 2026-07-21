import { describe, expect, it } from "bun:test";
import {
  sapAttachPayloadSchema,
  sapAttachOutputSchema,
  formatSapToolName,
  notificationListInputSchema,
  notificationMarkReadInputSchema,
  mapSapStreamMethodToApi,
  messageSendInputSchema,
  parseSapEnvelope,
  serializeSapEnvelope,
  sessionAcpDockInputSchema,
  conversationCommandsInputSchema,
  toolRegisterInputSchema,
  habitatRpcConnectPayloadSchema,
  HABITAT_RPC_VERSION,
  HABITAT_RPC_VERSION_LEGACY,
} from "@freeanima/shared/sap-contract";

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

  it("validates Habitat RPC connect payload", () => {
    const payload = habitatRpcConnectPayloadSchema.parse({
      protocol: HABITAT_RPC_VERSION,
      auth_token: "secret",
    });
    expect(payload.auth_token).toBe("secret");
  });

  it("accepts legacy Habitat RPC connect protocol", () => {
    const payload = habitatRpcConnectPayloadSchema.parse({
      protocol: HABITAT_RPC_VERSION_LEGACY,
      auth_token: "secret",
    });
    expect(payload.protocol).toBe(HABITAT_RPC_VERSION_LEGACY);
  });

  it("validates sap.attach payload", () => {
    const payload = sapAttachPayloadSchema.parse({
      app_id: "companion",
      instance_id: "k7m",
      features_requested: [],
      http_url: "http://127.0.0.1:4174",
    });
    expect(payload.http_url).toBe("http://127.0.0.1:4174");
  });

  it("validates chat procedure schemas", () => {
    sessionAcpDockInputSchema.parse({ conversation_id: "sid" });
    conversationCommandsInputSchema.parse({ platform: "sap:chat:k7m" });
    notificationListInputSchema.parse({ recipient_kind: "user", read_filter: "unread" });
    notificationMarkReadInputSchema.parse({ id: "n-1" });
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
    expect(formatSapToolName("companion", "k7m", "scan_code")).toBe("sap_companion_k7m_scan_code");
  });

  it("validates sap.attach output capability_mask presets shape", () => {
    const parsed = sapAttachOutputSchema.parse({
      instance_id: "k7m",
      features_enabled: ["capability_mask"],
      server_info: {
        anima_version: "0.5.0",
        habitat_rpc_version: HABITAT_RPC_VERSION,
        capability_mask: {
          presets: [{ name: "developer", allowed_tools_summary: ["file_read"] }],
        },
      },
    });
    expect(parsed.server_info?.capability_mask?.presets[0]?.name).toBe("developer");
  });

  it("accepts legacy hub_rpc_version in sap.attach output", () => {
    const parsed = sapAttachOutputSchema.parse({
      instance_id: "k7m",
      features_enabled: [],
      server_info: {
        anima_version: "0.5.0",
        hub_rpc_version: HABITAT_RPC_VERSION_LEGACY,
      },
    });
    expect(parsed.server_info?.hub_rpc_version).toBe(HABITAT_RPC_VERSION_LEGACY);
  });

  it("maps sap stream events to console sse shape", () => {
    const token = mapSapStreamMethodToApi("stream.token", {
      stream_id: "s1",
      content: "hi",
    });
    expect(token).toEqual({ event: "token", data: { content: "hi" } });
  });
});
