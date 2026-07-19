import type { SubjectKind } from "@freeanima/core/config";
import { getToolConversationId } from "@freeanima/core/tool/tool-context";
import { toolError } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";
import {
  resolveAgentVaultSecret,
  resolveUserVaultSecret,
} from "@freeanima/platform/connectors/vault";
import { defaultVaultSubjectForTools } from "@freeanima/features/vault/domain/vault-world";
import {
  resolveVaultToolWorld,
  SUBJECT_KIND_TOOL_PROPERTY,
  WORLD_ID_TOOL_PROPERTY,
} from "@freeanima/features/vault/domain/tool-world-resolve";

export type SubprocessSecretRef = {
  id: number;
  env_name: string;
  field?: string;
  subject_kind?: SubjectKind;
  world_id?: number;
};

/** JSON-schema fragment for terminal_run / code_execute `secrets` parameter. */
export const SECRETS_TOOL_PROPERTY = {
  type: "array",
  description:
    "Per-call vault secrets injected only into this subprocess env (never Hub process.env, never tool results). " +
    "Discover items via vault_list/vault_search/vault_get_meta first. Default subject_kind=agent.",
  items: {
    type: "object",
    properties: {
      id: { type: "integer", description: "Vault item id" },
      env_name: { type: "string", description: "Env var name for this subprocess (e.g. GH_TOKEN)" },
      field: {
        type: "string",
        description: 'Secret field path, default "password" (e.g. custom_fields.0.value)',
      },
      subject_kind: SUBJECT_KIND_TOOL_PROPERTY,
      world_id: WORLD_ID_TOOL_PROPERTY,
    },
    required: ["id", "env_name"],
  },
} as const;

function parseSubjectKind(raw: unknown): SubjectKind {
  if (raw === "user" || raw === "agent") return raw;
  return defaultVaultSubjectForTools();
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
    const id = Number(rec.id);
    if (!Number.isFinite(id) || id <= 0) return toolError("secrets[].id is required");
    const envName = String(rec.env_name ?? "").trim();
    if (!envName) return toolError("secrets[].env_name is required");
    const fieldRaw = rec.field != null ? String(rec.field).trim() : "";
    const worldRaw = Number(rec.world_id);
    out.push(
      omitUndefined({
        id,
        env_name: envName,
        field: fieldRaw || undefined,
        subject_kind: parseSubjectKind(rec.subject_kind),
        world_id: Number.isFinite(worldRaw) && worldRaw > 0 ? Math.floor(worldRaw) : undefined,
      }),
    );
  }
  return out;
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
    const field = (ref.field ?? "password").trim() || "password";
    const subjectKind = ref.subject_kind ?? defaultVaultSubjectForTools();
    const args: Record<string, unknown> = omitUndefined({
      subject_kind: subjectKind,
      world_id: ref.world_id,
    });
    const worldId = await resolveVaultToolWorld({
      args,
      entityId: ref.id,
      access: "write",
    });
    if (typeof worldId === "string") return worldId;

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
      env[ref.env_name] = value;
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
  return env;
}
