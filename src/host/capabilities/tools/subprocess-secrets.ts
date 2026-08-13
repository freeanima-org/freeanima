import type { SubjectKind } from "@freeanima/host/core/config";
import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { getToolConversationId } from "@freeanima/host/core/tool/tool-context";
import { toolError } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";
import {
  resolveAgentVaultSecret,
  resolveUserVaultSecret,
} from "@freeanima/host/capabilities/connectors/vault";
import {
  resolveVaultToolWorld,
  SUBJECT_KIND_TOOL_PROPERTY,
  WORLD_ID_TOOL_PROPERTY,
} from "@freeanima/features/vault/domain/tool-world-resolve";
import { coerceString } from "@freeanima/shared/coerce-string";

/** Vault item ref without env mapping (browser_type secret). */
export type BrowserSecretRef = {
  id: number;
  field: string;
};

/** Vault item ref for subprocess secrets (field optional → default password). */
export type VaultSecretRef = {
  id: number;
  field?: string;
  subject_kind?: SubjectKind;
  world_id?: number;
};

export type SubprocessSecretRef = VaultSecretRef & {
  env_name: string;
};

const SECRET_FIELD_PROPERTY = {
  type: "string",
  description:
    'Field name (default "password"): "password" / "notes" / "totp" (current TOTP code), or a name from the item\'s ' +
    "custom_field_names — same form for all; do not use custom_fields.N.value paths.",
} as const;

const SECRET_ID_PROPERTY = { type: "integer", description: "Vault item id" } as const;

/** JSON-schema fragment for browser_type `secret` parameter (single vault field → typed text). */
export const SECRET_TOOL_PROPERTY = {
  type: "object",
  description:
    "Vault secret to type into the input (never returned in tool results). " +
    "Discover items via vault_list/vault_search/vault_get_meta first (use custom_field_names as field). " +
    "Mutually exclusive with text. World resolved from vault item id.",
  properties: {
    id: SECRET_ID_PROPERTY,
    field: {
      type: "string",
      description:
        'Field name: "password" / "notes" / "totp" (current TOTP code), or a custom_field_names entry (e.g. "api_token")',
    },
  },
  required: ["id", "field"],
} as const;

/** JSON-schema fragment for terminal_run / code_execute `secrets` parameter. */
export const SECRETS_TOOL_PROPERTY = {
  type: "array",
  description:
    "Per-call vault secrets injected only into this subprocess env (never Habitat process.env, never tool results). " +
    "Discover items via vault_list/vault_search/vault_get_meta first; set field to password/notes/totp " +
    "(totp → current code) " +
    "or a custom_field_names entry (flat name, no path). " +
    "Pass subject_kind (user|agent) when needed; world_id optional override.",
  items: {
    type: "object",
    properties: {
      id: SECRET_ID_PROPERTY,
      env_name: { type: "string", description: "Env var name for this subprocess (e.g. GH_TOKEN)" },
      field: SECRET_FIELD_PROPERTY,
      subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
      world_id: WORLD_ID_TOOL_PROPERTY,
    },
    required: ["id", "env_name"],
  },
} as const;

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

function parseVaultSecretFields(
  rec: Record<string, unknown>,
  idError: string,
): VaultSecretRef | string {
  const id = Number(rec.id);
  if (!Number.isFinite(id) || id <= 0) return toolError(idError);
  const fieldRaw = rec.field != null ? coerceString(rec.field).trim() : "";
  const worldRaw = Number(rec.world_id);
  return omitUndefined({
    id,
    field: fieldRaw || undefined,
    subject_kind: parseSubjectKind(rec.subject_kind),
    world_id: Number.isFinite(worldRaw) && worldRaw > 0 ? Math.floor(worldRaw) : undefined,
  });
}

/** Parse optional single `secret` object; nullish → null; invalid → toolError JSON string. */
export function parseSecretArg(raw: unknown): BrowserSecretRef | null | string {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return toolError("secret must be an object");
  }
  const rec = raw as Record<string, unknown>;
  const id = Number(rec.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("secret.id is required");
  const field = coerceString(rec.field).trim();
  if (!field) return toolError("secret.field is required");
  return { id, field };
}

export function parseSecretsArg(raw: unknown): SubprocessSecretRef[] | string {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return toolError("secrets must be an array");
  const out: SubprocessSecretRef[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      return toolError("secrets[] entries must be objects");
    }
    const rec = item as Record<string, unknown>;
    const base = parseVaultSecretFields(rec, "secrets[].id is required");
    if (typeof base === "string") return base;
    const envName = coerceString(rec.env_name).trim();
    if (!envName) return toolError("secrets[].env_name is required");
    out.push({ ...base, env_name: envName });
  }
  return out;
}

/**
 * Resolve one vault ref to plaintext.
 * Success → `{ value }`; failure → toolError JSON string (caller should return it as-is).
 */
export async function resolveVaultSecretValue(
  ref: VaultSecretRef,
): Promise<{ value: string } | string> {
  const field = (ref.field ?? "password").trim() || "password";
  const args: Record<string, unknown> = omitUndefined({
    subject_kind: ref.subject_kind,
    world_id: ref.world_id,
  });
  const worldId = await resolveVaultToolWorld({
    args,
    entityId: ref.id,
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  let subjectKind = ref.subject_kind;
  if (subjectKind == null) {
    const ctx = getResolvedWorldContext();
    if (worldId === ctx.user_world_id) subjectKind = "user";
    else if (worldId === ctx.agent_world_id) subjectKind = "agent";
    else return toolError("subject_kind is required (user|agent) when world cannot be inferred");
  }

  try {
    let value: string;
    if (subjectKind === "user") {
      const conversationId = getToolConversationId() ?? undefined;
      value = await resolveUserVaultSecret(
        omitUndefined({
          item_id: ref.id,
          field,
          world_id: worldId,
          conversation_id: conversationId,
        }),
      );
    } else {
      value = await resolveAgentVaultSecret(worldId, ref.id, field);
    }
    return { value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "vault_locked" || msg === "vault_locked_user" || msg === "VAULT_SHELL_OFFLINE") {
      return toolError(
        subjectKind === "user"
          ? "user vault locked; unlock via Vault UI or Chat dedicated control"
          : "agent vault secret unavailable",
      );
    }
    if (msg === "NOT_FOUND" || msg === "FIELD_NOT_FOUND" || msg === "vault_field_not_found") {
      return toolError(`vault item or field not found: ${ref.id}/${field}`);
    }
    return toolError(msg);
  }
}

/**
 * Resolve vault refs to env_name → plaintext for a single spawn.
 * On failure returns a toolError JSON string (caller should return it as-is).
 */
export async function resolveSubprocessSecrets(
  refs: readonly SubprocessSecretRef[],
): Promise<Record<string, string> | string> {
  if (refs.length === 0) return {};

  const env: Record<string, string> = {};
  for (const ref of refs) {
    const resolved = await resolveVaultSecretValue(ref);
    if (typeof resolved === "string") return resolved;
    env[ref.env_name] = resolved.value;
  }
  return env;
}
