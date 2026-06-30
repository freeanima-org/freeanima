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

function isTokenActive(row: { revoked_at: Date | null; expires_at: Date | null }): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return false;
  return true;
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
  const token = await createServiceApiToken({
    subject_id: input.subject_id,
    name: input.name,
    prefix: parts.prefix,
    token_hash,
    scopes: input.scopes,
    expires_at: input.expires_at,
  });
  return { token, plaintext: parts.plaintext };
}

export async function verifyServiceApiToken(
  raw: string | null | undefined,
): Promise<VerifiedServiceApiToken | null> {
  const parsed = parseServiceApiToken(raw);
  if (!parsed) return null;
  const row = await getServiceApiTokenByPrefix(parsed.prefix);
  if (!row || !isTokenActive(row)) return null;
  const ok = await verifyServiceApiTokenSecret(parsed.secret, row.token_hash);
  if (!ok) return null;
  const subject = await getEntity(row.subject_id);
  if (!subject || (subject.type !== "user" && subject.type !== "agent")) return null;
  void touchServiceApiTokenLastUsed(row.id);
  return {
    token_id: row.id,
    subject_id: row.subject_id,
    subject_type: subject.type,
    scopes: row.scopes,
  };
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
    const token = await createServiceApiToken({
      subject_id: input.subject_id,
      name: input.name,
      prefix: parsed.prefix,
      token_hash,
      scopes: input.scopes,
    });
    return { token, plaintext: trimmed };
  }
  const parts = generateServiceApiTokenParts();
  const token_hash = await hashServiceApiTokenSecret(trimmed);
  const token = await createServiceApiToken({
    subject_id: input.subject_id,
    name: input.name,
    prefix: parts.prefix,
    token_hash,
    scopes: input.scopes,
  });
  return { token, plaintext: `${SERVICE_API_TOKEN_PREFIX}${parts.prefix}_${trimmed}` };
}

export {
  countServiceApiTokens,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
} from "./repos/token-repo.ts";
export * from "./crypto.ts";
export * from "./types.ts";
