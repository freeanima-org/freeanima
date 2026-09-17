import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";

const VAULT_REF_RE = /^vault\("(\d+)",\s*"([^"]*)"\)$/;

export type VaultRef = {
  itemId: number;
  field: string;
};

export function formatVaultRef(itemId: number, field: string): string {
  return `vault("${itemId}", "${field}")`;
}

export function parseVaultRef(value: string): VaultRef | null {
  const match = VAULT_REF_RE.exec(value.trim());
  if (!match) return null;
  const itemId = Number(match[1]);
  const field = match[2];
  if (!Number.isFinite(itemId) || itemId <= 0 || !field) return null;
  return { itemId, field };
}

const CARD_FIELDS = [
  "card.number",
  "card.code",
  "card.brand",
  "card.cardholder",
  "card.exp_month",
  "card.exp_year",
] as const;

const IDENTITY_FIELDS = [
  "identity.email",
  "identity.username",
  "identity.first_name",
  "identity.last_name",
  "identity.phone",
  "identity.ssn",
  "identity.passport_number",
  "identity.license_number",
] as const;

/** 与 resolveSecretField 对齐的可选字段（含条目 custom_field_names） */
export function vaultRefFieldCandidates(
  item: Pick<VaultItemMetaRowPayload, "item_type" | "custom_field_names">,
): string[] {
  const fields: string[] = ["password", "notes", "totp"];
  const type = item.item_type;
  if (type === "card") fields.push(...CARD_FIELDS);
  if (type === "identity") fields.push(...IDENTITY_FIELDS);
  for (const name of item.custom_field_names) {
    const trimmed = name.trim();
    if (trimmed && !fields.includes(trimmed)) fields.push(trimmed);
  }
  return fields;
}
