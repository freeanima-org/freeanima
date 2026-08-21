import type { ServiceApiTokenAuthorization } from "@freeanima/shared/service-api-auth";
import { FULL_TOKEN_AUTHORIZATION } from "@freeanima/shared/service-api-auth";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getEntity } from "../entity/index.ts";
import {
  generateServiceApiTokenParts,
  hashServiceApiTokenSecret,
  parseServiceApiToken,
  SERVICE_API_TOKEN_PREFIX,
  verifyServiceApiTokenSecret,
} from "./crypto.ts";
import {
  createServiceApiToken,
  getServiceApiTokenById,
  getServiceApiTokenByPrefix,
  touchServiceApiTokenLastUsed,
  updateServiceApiTokenName as updateServiceApiTokenNameRow,
} from "./repos/token-repo.ts";
import {
  toServiceApiTokenPublic,
  type CreateServiceApiTokenResult,
  type ServiceApiTokenPublic,
  type VerifiedServiceApiToken,
} from "./types.ts";

export type { VerifiedServiceApiToken, ServiceApiTokenPublic, CreateServiceApiTokenResult };

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
  authorization?: ServiceApiTokenAuthorization;
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
      token_secret: parts.secret,
      authorization: input.authorization ?? FULL_TOKEN_AUTHORIZATION,
      expires_at: input.expires_at,
    }),
  );
  return { token, plaintext: parts.plaintext };
}

export async function revealServiceApiTokenPlaintext(id: number): Promise<string> {
  const row = await getServiceApiTokenById(id);
  if (!row) {
    throw new Error(`token ${id} not found`);
  }
  if (!isTokenActive(row)) {
    throw new Error(`token ${id} is revoked or expired`);
  }
  if (!row.token_secret) {
    throw new Error(`token ${id} is not revealable; recreate the token`);
  }
  return `${SERVICE_API_TOKEN_PREFIX}${row.prefix}_${row.token_secret}`;
}

export async function updateServiceApiTokenName(
  id: number,
  name: string,
): Promise<ServiceApiTokenPublic> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("name is required");
  }
  const existing = await getServiceApiTokenById(id);
  if (!existing) {
    throw new Error(`token ${id} not found`);
  }
  const ok = await updateServiceApiTokenNameRow(id, trimmed);
  if (!ok) {
    throw new Error(`token ${id} not found`);
  }
  const row = await getServiceApiTokenById(id);
  if (!row) {
    throw new Error(`token ${id} not found`);
  }
  return toServiceApiTokenPublic(row);
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
    authorization: row.authorization,
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
  authorization?: ServiceApiTokenAuthorization;
}): Promise<CreateServiceApiTokenResult> {
  const trimmed = input.plaintext.trim();
  const authorization = input.authorization ?? FULL_TOKEN_AUTHORIZATION;
  const parsed = parseServiceApiToken(trimmed);
  if (parsed) {
    const token_hash = await hashServiceApiTokenSecret(parsed.secret);
    const token = await createServiceApiToken(
      omitUndefined({
        subject_id: input.subject_id,
        name: input.name,
        prefix: parsed.prefix,
        token_hash,
        token_secret: parsed.secret,
        authorization,
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
      token_secret: trimmed,
      authorization,
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
