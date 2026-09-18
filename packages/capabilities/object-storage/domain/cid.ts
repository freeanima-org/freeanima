import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** BLAKE3 截断 128 bit → 32 小写 hex */
export function cidFromBytes(bytes: Uint8Array): string {
  const digest = blake3(bytes, { dkLen: 16 });
  return bytesToHex(digest);
}

export function objectStorageKey(worldId: number, cid: string): string {
  return `world/${worldId}/b3/${cid}`;
}
