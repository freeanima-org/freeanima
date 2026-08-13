import type { ServiceApiTokenRow } from "@freeanima/host/core/db/schema/rows";

export type ServiceApiTokenPublic = {
  id: number;
  subject_id: number;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
  /** 是否可再次 reveal 明文（有存档 token_secret） */
  revealable: boolean;
};

export type CreateServiceApiTokenInput = {
  subject_id: number;
  name: string;
  prefix: string;
  token_hash: string;
  token_secret?: string | null;
  scopes?: string[];
  expires_at?: Date | null;
};

export function toServiceApiTokenPublic(row: ServiceApiTokenRow): ServiceApiTokenPublic {
  return {
    id: row.id,
    subject_id: row.subject_id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    created_at: row.created_at,
    expires_at: row.expires_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at,
    revealable: Boolean(row.token_secret),
  };
}
