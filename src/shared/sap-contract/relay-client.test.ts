import { describe, expect, it } from "bun:test";
import { SAP_RELAY_READY_METHOD, serializeSapEnvelope } from "@freeanima/shared/sap-contract";

describe("sap relay client constants", () => {
  it("uses relay.ready event method", () => {
    expect(SAP_RELAY_READY_METHOD).toBe("relay.ready");
    const frame = serializeSapEnvelope({
      kind: "evt",
      method: SAP_RELAY_READY_METHOD,
      payload: { ok: true },
    });
    expect(frame).toContain("relay.ready");
  });
});
