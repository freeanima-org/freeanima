import { describe, expect, it } from "bun:test";
import { deriveEd25519KeyPair, verifyEd25519 } from "@freeanima/shared/identity";
import {
  buildHandshakeSignPayload,
  createHubAck,
  createSatelliteHello,
  verifyAckSignature,
  verifyHelloSignature,
} from "./handshake.ts";

describe("federation handshake", () => {
  it("round-trips satellite hello and hub ack", () => {
    const satellite = deriveEd25519KeyPair({
      salt: "fa_inst_satellite1",
      info: "test-satellite",
    });
    const hub = deriveEd25519KeyPair({ salt: "fa_inst_hub1", info: "test-hub" });

    const hello = createSatelliteHello({
      habitat_instance_id: "fa_inst_satellite1",
      public_key: satellite.public_key,
      private_key: satellite.private_key,
    });
    expect(verifyHelloSignature(hello)).toBe(true);

    const ack = createHubAck({
      hub: {
        habitat_instance_id: "fa_inst_hub1",
        public_key: hub.public_key,
        private_key: hub.private_key,
      },
      echo_nonce: hello.nonce,
      trust_state: "trusted",
    });
    expect(verifyAckSignature(ack)).toBe(true);
    expect(ack.echo_nonce).toBe(hello.nonce);

    const payload = buildHandshakeSignPayload({
      habitat_instance_id: "fa_inst_hub1",
      nonce: ack.nonce,
      echo_nonce: hello.nonce,
    });
    expect(verifyEd25519(payload, ack.signature, hub.public_key)).toBe(true);
  });
});
