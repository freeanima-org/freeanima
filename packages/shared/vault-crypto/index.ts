import { generateTotpCode } from "./totp.ts";

export type VaultCustomField = {
  name: string;
  value: string;
  type: "text" | "hidden" | "boolean";
};

export type VaultCardSecrets = {
  brand?: string;
  number?: string;
  code?: string;
  cardholder?: string;
  exp_month?: string;
  exp_year?: string;
};

export type VaultIdentitySecrets = {
  title?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  username?: string;
  company?: string;
  ssn?: string;
  passport_number?: string;
  license_number?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type VaultSecretsPayload = {
  password?: string;
  notes?: string;
  totp?: string;
  custom_fields?: VaultCustomField[];
  card?: VaultCardSecrets;
  identity?: VaultIdentitySecrets;
  [key: string]: unknown;
};

export { generateTotpCode, normalizeTotpSecret, type TotpCodeResult } from "./totp.ts";

const PBKDF2_ITERATIONS = 600_000;
const AES_GCM_IV_BYTES = 12;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("Web Crypto API unavailable");
  }
  return c;
}

function bytesToB64(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes);
  let binary = "";
  for (const byte of copy) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function utf8Decode(bytes: ArrayBuffer): string {
  return new TextDecoder().decode(bytes);
}

export function randomSalt(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  getCrypto().getRandomValues(buf);
  return bytesToB64(buf);
}

export async function deriveMasterKey(
  masterPassword: string,
  saltB64: string,
  iterations = PBKDF2_ITERATIONS,
  opts?: { extractable?: boolean },
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    asBufferSource(utf8Encode(masterPassword)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asBufferSource(b64ToBytes(saltB64)),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    opts?.extractable === true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

export async function createVerifier(masterKey: CryptoKey): Promise<string> {
  const crypto = getCrypto();
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    masterKey,
    asBufferSource(utf8Encode("freeanima-vault-verifier-v1")),
  );
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(cipher))}`;
}

export async function verifyMasterKey(masterKey: CryptoKey, verifier: string): Promise<boolean> {
  const [ivB64, cipherB64] = verifier.split(":");
  if (!ivB64 || !cipherB64) return false;
  try {
    const plain = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(b64ToBytes(ivB64)) },
      masterKey,
      asBufferSource(b64ToBytes(cipherB64)),
    );
    return utf8Decode(plain) === "freeanima-vault-verifier-v1";
  } catch {
    return false;
  }
}

export async function importRawAesKey(
  rawKey: Uint8Array,
  opts?: { extractable?: boolean },
): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "raw",
    asBufferSource(rawKey),
    { name: "AES-GCM", length: 256 },
    opts?.extractable === true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}

export async function wrapDek(dek: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  getCrypto().getRandomValues(iv);
  const wrapped = await getCrypto().subtle.wrapKey("raw", dek, wrappingKey, {
    name: "AES-GCM",
    iv,
  });
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(wrapped))}`;
}

export async function unwrapDek(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const [ivB64, dataB64] = wrapped.split(":");
  if (!ivB64 || !dataB64) throw new Error("invalid dek_wrapped");
  return getCrypto().subtle.unwrapKey(
    "raw",
    asBufferSource(b64ToBytes(dataB64)),
    wrappingKey,
    { name: "AES-GCM", iv: asBufferSource(b64ToBytes(ivB64)) },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecrets(
  secrets: VaultSecretsPayload,
  dek: CryptoKey,
): Promise<string> {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  getCrypto().getRandomValues(iv);
  const cipher = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    dek,
    asBufferSource(utf8Encode(JSON.stringify(secrets))),
  );
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(cipher))}`;
}

export async function decryptSecrets(
  secretsEnc: string,
  dek: CryptoKey,
): Promise<VaultSecretsPayload> {
  const [ivB64, dataB64] = secretsEnc.split(":");
  if (!ivB64 || !dataB64) throw new Error("invalid secrets_enc");
  const plain = await getCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(b64ToBytes(ivB64)) },
    dek,
    asBufferSource(b64ToBytes(dataB64)),
  );
  return JSON.parse(utf8Decode(plain)) as VaultSecretsPayload;
}

export async function sealVaultSecrets(
  secrets: VaultSecretsPayload,
  wrappingKey: CryptoKey,
): Promise<{ secrets_enc: string; dek_wrapped: string }> {
  const dek = await generateDek();
  const secrets_enc = await encryptSecrets(secrets, dek);
  const dek_wrapped = await wrapDek(dek, wrappingKey);
  return { secrets_enc, dek_wrapped };
}

export async function openVaultSecrets(
  secrets_enc: string,
  dek_wrapped: string,
  wrappingKey: CryptoKey,
): Promise<VaultSecretsPayload> {
  const dek = await unwrapDek(dek_wrapped, wrappingKey);
  return decryptSecrets(secrets_enc, dek);
}

export async function rewrapAllDekWrapped(
  items: Array<{ id: number; dek_wrapped: string }>,
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<Array<{ id: number; dek_wrapped: string }>> {
  const out: Array<{ id: number; dek_wrapped: string }> = [];
  for (const item of items) {
    const dek = await unwrapDek(item.dek_wrapped, oldKey);
    const dek_wrapped = await wrapDek(dek, newKey);
    out.push({ id: item.id, dek_wrapped });
  }
  return out;
}

export function extractCustomFieldNames(secrets: VaultSecretsPayload): string[] {
  const fields = secrets.custom_fields ?? [];
  return fields.map((f) => f.name).filter(Boolean);
}

function nestedSecretString(
  group: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!group) return undefined;
  const val = group[key];
  return typeof val === "string" ? val.trim() : undefined;
}

export function resolveSecretField(
  secrets: VaultSecretsPayload,
  fieldPath: string,
): string | undefined {
  // Built-in fields first (names take precedence over same-named custom_fields).
  if (fieldPath === "password" && typeof secrets.password === "string") {
    return secrets.password.trim();
  }
  if (fieldPath === "notes" && typeof secrets.notes === "string") {
    // Preserve intentional leading/trailing whitespace in notes.
    return secrets.notes;
  }
  if (fieldPath === "totp" && typeof secrets.totp === "string") {
    // 注入/解析返回当前动态码；编辑 UI 应读 secrets.totp 原文密钥。
    const result = generateTotpCode(secrets.totp);
    return result?.code;
  }

  const cardMatch = /^card\.(.+)$/.exec(fieldPath);
  if (cardMatch?.[1]) {
    return nestedSecretString(secrets.card, cardMatch[1]);
  }
  const identityMatch = /^identity\.(.+)$/.exec(fieldPath);
  if (identityMatch?.[1]) {
    return nestedSecretString(secrets.identity, identityMatch[1]);
  }

  // Flat name: same form as password — no custom_fields. prefix required.
  const byName = secrets.custom_fields?.find((f) => f.name === fieldPath);
  if (byName && typeof byName.value === "string") {
    return byName.value.trim();
  }

  // Legacy index path (compat).
  const customMatch = /^custom_fields\.(\d+)\.value$/.exec(fieldPath);
  if (customMatch) {
    const idx = Number(customMatch[1]);
    const val = secrets.custom_fields?.[idx]?.value;
    return typeof val === "string" ? val.trim() : undefined;
  }

  const direct = secrets[fieldPath];
  return typeof direct === "string" ? direct.trim() : undefined;
}
