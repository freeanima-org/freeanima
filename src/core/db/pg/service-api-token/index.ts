import { getEntity } from "../entity/index.ts";
import { omitUndefined } from "@freeanima/core/util";
import {
  generateServiceApiTokenParts,
  hashServiceApiTokenSecret,
  parseServiceApiToken,
  SERVICE_API_TOKEN_PREFIX,
  verifyServiceApiTokenSecret,
} from "./crypto.ts";
import {
  createServiceApiToken,
  getServiceApiTokenByPrefix,
  touchServiceApiTokenLastUsed,
} from "./repos/token-repo.ts";
import type { ServiceApiTokenPublic } from "./types.ts";

export type VerifiedServiceApiToken = {
  token_id: number;
  subject_id: number;
  subject_type: "user" | "agent";
  scopes: string[];
};

export type CreateServiceApiTokenResult = {
  token: ServiceApiTokenPublic;
  plaintext: string;
};

const TOKEN_VERIFY_CACHE_TTL_MS = 30_000;
const TOKEN_LAST_USED_THROTTLE_MS = 60_000;

type CachedVerifiedToken = {
  expiresAt: number;
  lastTouchAt: number;
  value: VerifiedServiceApiToken;
  tokenHash: string;
};

const verifiedTokenCache = new Map<string, CachedVerifiedToken>();

function isTokenActive(row: { revoked_at: Date | null; expires_at: Date | null }): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return false;
  return true;
}

function cacheKey(prefix: string): string {
  return prefix;
}

/** 测试 / 吊销后可清缓存 */
export function clearServiceApiTokenVerifyCache(): void {
  verifiedTokenCache.clear();
}

export async function createServiceApiTokenWithSecret(input: {
  subject_id: number;
  name: string;
  scopes?: string[];
  expires_at?: Date | null;
}): Promise<CreateServiceApiTokenResult> {
  const subject = await getEntity(input.subject_id);
  if (!subject || (subject.type !== "user" && subject.type !== "agent")) {
    throw new Error(`subject ${input.subject_id} is not a user or agent entity`);
  }
  const parts = generateServiceApiTokenParts();
  const token_hash = await hashServiceApiTokenSecret(parts.secret);
  const token = await createServiceApiToken(
    omitUndefined({
      subject_id: input.subject_id,
      name: input.name,
      prefix: parts.prefix,
      token_hash,
      scopes: input.scopes,
      expires_at: input.expires_at,
    }),
  );
  return { token, plaintext: parts.plaintext };
}

export async function verifyServiceApiToken(
  raw: string | null | undefined,
): Promise<VerifiedServiceApiToken | null> {
  const parsed = parseServiceApiToken(raw);
  if (!parsed) return null;

  const key = cacheKey(parsed.prefix);
  const cached = verifiedTokenCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    const ok = await verifyServiceApiTokenSecret(parsed.secret, cached.tokenHash);
    if (!ok) {
      verifiedTokenCache.delete(key);
      return null;
    }
    if (now - cached.lastTouchAt >= TOKEN_LAST_USED_THROTTLE_MS) {
      cached.lastTouchAt = now;
      void touchServiceApiTokenLastUsed(cached.value.token_id);
    }
    return cached.value;
  }

  const row = await getServiceApiTokenByPrefix(parsed.prefix);
  if (!row || !isTokenActive(row)) {
    verifiedTokenCache.delete(key);
    return null;
  }
  const ok = await verifyServiceApiTokenSecret(parsed.secret, row.token_hash);
  if (!ok) return null;
  const subject = await getEntity(row.subject_id);
  if (!subject || (subject.type !== "user" && subject.type !== "agent")) return null;
  const value: VerifiedServiceApiToken = {
    token_id: row.id,
    subject_id: row.subject_id,
    subject_type: subject.type,
    scopes: row.scopes,
  };
  verifiedTokenCache.set(key, {
    expiresAt: now + TOKEN_VERIFY_CACHE_TTL_MS,
    lastTouchAt: now,
    value,
    tokenHash: row.token_hash,
  });
  void touchServiceApiTokenLastUsed(row.id);
  return value;
}

/** 迁移 remote_auth：保留原 secret 语义，生成新 prefix */
export async function importServiceApiTokenFromPlaintext(input: {
  subject_id: number;
  name: string;
  plaintext: string;
  scopes?: string[];
}): Promise<CreateServiceApiTokenResult> {
  const trimmed = input.plaintext.trim();
  const parsed = parseServiceApiToken(trimmed);
  if (parsed) {
    const token_hash = await hashServiceApiTokenSecret(parsed.secret);
    const token = await createServiceApiToken(
      omitUndefined({
        subject_id: input.subject_id,
        name: input.name,
        prefix: parsed.prefix,
        token_hash,
        scopes: input.scopes,
      }),
    );
    return { token, plaintext: trimmed };
  }
  const parts = generateServiceApiTokenParts();
  const token_hash = await hashServiceApiTokenSecret(trimmed);
  const token = await createServiceApiToken(
    omitUndefined({
      subject_id: input.subject_id,
      name: input.name,
      prefix: parts.prefix,
      token_hash,
      scopes: input.scopes,
    }),
  );
  return { token, plaintext: `${SERVICE_API_TOKEN_PREFIX}${parts.prefix}_${trimmed}` };
}

export {
  countServiceApiTokens,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
} from "./repos/token-repo.ts";
import { revokeServiceApiToken as revokeServiceApiTokenRow } from "./repos/token-repo.ts";

export async function revokeServiceApiToken(id: number): Promise<boolean> {
  const ok = await revokeServiceApiTokenRow(id);
  if (ok) clearServiceApiTokenVerifyCache();
  return ok;
}

export * from "./crypto.ts";
export * from "./types.ts";
