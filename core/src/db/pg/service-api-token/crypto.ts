export const SERVICE_API_TOKEN_PREFIX = "fa_at_";

const PREFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SECRET_BYTES = 32;

export type ParsedServiceApiToken = {
  prefix: string;
  secret: string;
};

export type GeneratedServiceApiToken = {
  prefix: string;
  secret: string;
  plaintext: string;
};

function randomAlphanumeric(length: number): string {
  const charsetLen = PREFIX_CHARS.length;
  const limit = Math.floor(256 / charsetLen) * charsetLen;
  const out: string[] = [];
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  for (const byte of bytes) {
    if (byte >= limit) continue;
    out.push(PREFIX_CHARS[byte % charsetLen]!);
    if (out.length === length) break;
  }
  while (out.length < length) {
    const extra = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of extra) {
      if (byte >= limit) continue;
      out.push(PREFIX_CHARS[byte % charsetLen]!);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

export function generateServiceApiTokenParts(): GeneratedServiceApiToken {
  const prefix = randomAlphanumeric(12);
  const secretBytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const secret = Buffer.from(secretBytes).toString("base64url");
  const plaintext = `${SERVICE_API_TOKEN_PREFIX}${prefix}_${secret}`;
  return { prefix, secret, plaintext };
}

export function parseServiceApiToken(raw: string | null | undefined): ParsedServiceApiToken | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(SERVICE_API_TOKEN_PREFIX)) return null;
  const body = trimmed.slice(SERVICE_API_TOKEN_PREFIX.length);
  const sep = body.indexOf("_");
  if (sep <= 0) return null;
  const prefix = body.slice(0, sep);
  const secret = body.slice(sep + 1);
  if (!prefix || !secret) return null;
  return { prefix, secret };
}

export async function hashServiceApiTokenSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("base64url");
}

export function tokensEqual(expected: string, provided: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function verifyServiceApiTokenSecret(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  const hash = await hashServiceApiTokenSecret(secret);
  return tokensEqual(storedHash, hash);
}
