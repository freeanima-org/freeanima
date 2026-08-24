import { randomPublicId, isRecord } from "@freeanima/shared/util";
import { signEd25519, verifyEd25519 } from "@freeanima/shared/identity";

import {
  federationHandshakeAckSchema,
  federationHandshakeHelloSchema,
} from "@freeanima/shared/rpc-contract/frames/federation.ts";

const textEncoder = new TextEncoder();

export type FederationIdentityMaterial = {
  habitat_instance_id: string;
  public_key: string;
  private_key: string;
};

export function buildHandshakeSignPayload(input: {
  habitat_instance_id: string;
  nonce: string;
  echo_nonce?: string;
}): string {
  const parts = [input.habitat_instance_id, input.nonce];
  if (input.echo_nonce) parts.push(input.echo_nonce);
  return parts.join(":");
}

export function createSatelliteHello(identity: FederationIdentityMaterial) {
  const nonce = randomPublicId();
  const signature = signEd25519(
    buildHandshakeSignPayload({ habitat_instance_id: identity.habitat_instance_id, nonce }),
    identity.private_key,
  );
  return federationHandshakeHelloSchema.parse({
    habitat_instance_id: identity.habitat_instance_id,
    public_key: identity.public_key,
    nonce,
    signature,
  });
}

export function createHubAck(input: {
  hub: FederationIdentityMaterial;
  echo_nonce: string;
  trust_state: "trusted" | "pending";
}) {
  const nonce = randomPublicId();
  const signature = signEd25519(
    buildHandshakeSignPayload({
      habitat_instance_id: input.hub.habitat_instance_id,
      nonce,
      echo_nonce: input.echo_nonce,
    }),
    input.hub.private_key,
  );
  return federationHandshakeAckSchema.parse({
    habitat_instance_id: input.hub.habitat_instance_id,
    public_key: input.hub.public_key,
    nonce,
    echo_nonce: input.echo_nonce,
    signature,
    trust_state: input.trust_state,
  });
}

export function verifyHelloSignature(hello: {
  habitat_instance_id: string;
  public_key: string;
  nonce: string;
  signature: string;
}): boolean {
  return verifyEd25519(
    buildHandshakeSignPayload({
      habitat_instance_id: hello.habitat_instance_id,
      nonce: hello.nonce,
    }),
    hello.signature,
    hello.public_key,
  );
}

export function verifyAckSignature(ack: {
  habitat_instance_id: string;
  public_key: string;
  nonce: string;
  echo_nonce: string;
  signature: string;
}): boolean {
  return verifyEd25519(
    buildHandshakeSignPayload({
      habitat_instance_id: ack.habitat_instance_id,
      nonce: ack.nonce,
      echo_nonce: ack.echo_nonce,
    }),
    ack.signature,
    ack.public_key,
  );
}

export function encodeFederationFrame(method: string, payload: unknown): string {
  return JSON.stringify({ method, payload });
}

export function parseFederationFrame(raw: string): { method: string; payload: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const method = parsed.method;
    if (typeof method !== "string") return null;
    return { method, payload: parsed.payload };
  } catch {
    return null;
  }
}

export function federationPingMessage(message?: string): string {
  return message?.trim() ? message.trim() : "ping";
}

export function federationPongMessage(message: string): string {
  return message === "ping" ? "pong" : `pong:${message}`;
}

export function encodeText(value: string): Uint8Array {
  return textEncoder.encode(value);
}
