import * as ed from "@noble/ed25519";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

ed.etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(ed.etc.concatBytes(...msgs));

const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(raw: string): Uint8Array {
  const padded = raw.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type DerivedEd25519KeyPair = {
  public_key: string;
  private_key: string;
};

/**
 * 以 salt 字符串为 HKDF salt、独立 IKM 派生 Ed25519 密钥对。
 * 落库以返回的公私钥为准（IKM 不落库）。
 */
export function deriveEd25519KeyPair(input: {
  salt: string;
  info: string;
  ikm?: Uint8Array;
}): DerivedEd25519KeyPair {
  const ikm = input.ikm ?? crypto.getRandomValues(new Uint8Array(32));
  if (ikm.byteLength !== 32) {
    throw new Error("deriveEd25519KeyPair: ikm must be 32 bytes");
  }
  const seed = hkdf(
    sha256,
    ikm,
    textEncoder.encode(input.salt),
    textEncoder.encode(input.info),
    32,
  );
  const publicKey = ed.getPublicKey(seed);
  return {
    public_key: bytesToBase64Url(publicKey),
    private_key: bytesToBase64Url(seed),
  };
}

export function signEd25519(message: Uint8Array | string, privateKeyB64Url: string): string {
  const msg = typeof message === "string" ? textEncoder.encode(message) : message;
  const seed = base64UrlToBytes(privateKeyB64Url);
  return bytesToBase64Url(ed.sign(msg, seed));
}

export function verifyEd25519(
  message: Uint8Array | string,
  signatureB64Url: string,
  publicKeyB64Url: string,
): boolean {
  const msg = typeof message === "string" ? textEncoder.encode(message) : message;
  return ed.verify(base64UrlToBytes(signatureB64Url), msg, base64UrlToBytes(publicKeyB64Url));
}

export const HABITAT_INSTANCE_ID_PREFIX = "fa_inst_";
export const HABITAT_ED25519_INFO = "freeanima-habitat-ed25519-v1";
export const SUBJECT_ED25519_INFO = "freeanima-subject-ed25519-v1";

export function formatHabitatInstanceId(publicId: string): string {
  return `${HABITAT_INSTANCE_ID_PREFIX}${publicId}`;
}

export function subjectKeySalt(habitatInstanceId: string, subjectPublicId: string): string {
  return `${habitatInstanceId}:${subjectPublicId}`;
}
