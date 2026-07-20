import { SAP_INSTANCE_ID_PATTERN } from "./naming.ts";

const INSTANCE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a random 3-char Habitat instance id candidate */
export function generateSapInstanceIdCandidate(): string {
  let out = "";
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * INSTANCE_ALPHABET.length);
    const char = INSTANCE_ALPHABET[idx];
    if (char === undefined) {
      throw new Error("generateSapInstanceIdCandidate: empty alphabet");
    }
    out += char;
  }
  return out;
}

export function assertSapInstanceId(instanceId: string): string {
  const norm = instanceId.trim().toLowerCase();
  if (!SAP_INSTANCE_ID_PATTERN.test(norm)) {
    throw new Error(`invalid SAP instance_id: ${instanceId}`);
  }
  return norm;
}
