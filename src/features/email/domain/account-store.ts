import {
  EMAIL_ACCOUNT_COMPONENT,
  asEmailAccount,
  type EmailAccountBody,
} from "@freeanima/host/core/db/schema/entity";
import {
  assertEntityInWorld,
  createEntity,
  deleteEmailEntitiesByAccountId,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { removeEmailAccountAttachments } from "./attachment-store.ts";
import type { EmailAccountCreateInput, EmailAccountRow, EmailAccountUpdateInput } from "./types.ts";

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function accountTitle(input: { display_name?: string; address: string }): string {
  return (input.display_name?.trim() || input.address.trim()).slice(0, 500);
}

function toAccountRow(
  row: NonNullable<ReturnType<typeof asEmailAccount>>,
  meta: { created_at: Date; updated_at: Date },
): EmailAccountRow {
  return {
    id: row.id,
    display_name: row.display_name,
    address: row.address,
    password: row.password,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    imap_host: row.imap_host,
    imap_port: row.imap_port,
    default_sender: row.default_sender ?? false,
    enabled: row.enabled ?? true,
    desc: row.desc,
    tags: row.tags ?? [],
    sync: row.sync,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function listAccountEntities(worldId: number) {
  return listEntities({
    world_id: worldId,
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    limit: 200,
  });
}

async function normalizeDefaultSender(worldId: number, preferredId?: number): Promise<void> {
  const rows = await listAccountEntities(worldId);
  const accounts = rows
    .map((row) => {
      const parsed = asEmailAccount(row);
      return parsed ? { row, parsed } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v != null);

  const enabled = accounts.filter(({ parsed }) => parsed.enabled !== false);
  if (enabled.length === 0) return;

  const defaults = accounts.filter(({ parsed }) => parsed.default_sender);
  let keepId = preferredId;
  if (keepId == null) {
    if (defaults.length === 1) return;
    keepId = defaults[0]?.parsed.id ?? enabled[0]?.parsed.id;
  }

  for (const { row, parsed } of accounts) {
    const nextDefault = parsed.id === keepId && parsed.enabled !== false;
    if (Boolean(parsed.default_sender) === nextDefault) continue;
    await updateEntity({ id: row.id, body: { ...parsed, default_sender: nextDefault } });
  }
}

export async function listEmailAccountRows(worldId: number): Promise<EmailAccountRow[]> {
  const rows = await listAccountEntities(worldId);
  return rows
    .map((row) => {
      const parsed = asEmailAccount(row);
      return parsed
        ? toAccountRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is EmailAccountRow => row != null)
    .toSorted((a, b) => a.id - b.id);
}

export async function getEmailAccountRow(id: number): Promise<EmailAccountRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailAccount(row);
  if (!parsed) return null;
  return toAccountRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function findEmailAccountByAddressAndHost(
  worldId: number,
  address: string,
  smtpHost: string,
): Promise<EmailAccountRow | null> {
  const accounts = await listEmailAccountRows(worldId);
  return accounts.find((a) => a.address === address && a.smtp_host === smtpHost) ?? null;
}

export async function createEmailAccount(
  worldId: number,
  input: EmailAccountCreateInput,
): Promise<EmailAccountRow> {
  const body: EmailAccountBody = {
    address: input.address.trim(),
    password: input.password,
    smtp_host: input.smtp_host,
    smtp_port: input.smtp_port,
    imap_host: input.imap_host,
    imap_port: input.imap_port,
    default_sender: input.default_sender ?? false,
    enabled: input.enabled ?? true,
    desc: input.desc,
    tags: normalizeTags(input.tags),
    sync: { mailbox: "INBOX" },
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [EMAIL_ACCOUNT_COMPONENT],
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    title: accountTitle(input),
    body,
  });

  if (body.default_sender) {
    await normalizeDefaultSender(worldId, row.id);
  } else {
    await normalizeDefaultSender(worldId);
  }

  const refreshed = await getEmailAccountRow(row.id);
  if (!refreshed) throw new Error("failed to load created email account");
  return refreshed;
}

export async function updateEmailAccount(
  worldId: number,
  input: EmailAccountUpdateInput,
): Promise<EmailAccountRow | null> {
  const existing = await getEmailAccountRow(input.id);
  if (!existing) return null;
  await assertEntityInWorld(input.id, worldId);

  const merged: EmailAccountBody = {
    address: input.address?.trim() ?? existing.address,
    password: input.password ?? existing.password,
    smtp_host: input.smtp_host ?? existing.smtp_host,
    smtp_port: input.smtp_port ?? existing.smtp_port,
    imap_host: input.imap_host ?? existing.imap_host,
    imap_port: input.imap_port ?? existing.imap_port,
    default_sender: input.default_sender ?? existing.default_sender,
    enabled: input.enabled ?? existing.enabled,
    desc: input.desc ?? existing.desc,
    tags: input.tags != null ? normalizeTags(input.tags) : existing.tags,
    sync: input.sync ?? existing.sync,
  };

  const row = await updateEntity({
    id: input.id,
    title: accountTitle({
      display_name: input.display_name ?? existing.display_name,
      address: merged.address,
    }),
    body: merged,
  });
  if (!row) return null;

  if (merged.default_sender) {
    await normalizeDefaultSender(worldId, input.id);
  } else {
    await normalizeDefaultSender(worldId);
  }

  return getEmailAccountRow(input.id);
}

export async function deleteEmailAccountRow(worldId: number, id: number): Promise<boolean> {
  await assertEntityInWorld(id, worldId);
  await deleteEmailEntitiesByAccountId(worldId, id);
  await removeEmailAccountAttachments(id);
  const ok = await deleteEntity(id);
  if (ok) await normalizeDefaultSender(worldId);
  return ok;
}

export async function getDefaultEmailAccountRow(worldId: number): Promise<EmailAccountRow | null> {
  const accounts = (await listEmailAccountRows(worldId)).filter((a) => a.enabled);
  return accounts.find((a) => a.default_sender) ?? accounts[0] ?? null;
}

export async function resolveEmailAccountRow(
  worldId: number,
  accountId?: number,
): Promise<EmailAccountRow> {
  const accounts = (await listEmailAccountRows(worldId)).filter((a) => a.enabled);
  if (accounts.length === 0) throw new Error("No enabled email accounts configured");

  if (accountId != null) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`Email account not found or disabled: ${accountId}`);
    return account;
  }

  const fallback = await getDefaultEmailAccountRow(worldId);
  if (!fallback) throw new Error("No default sender account found");
  return fallback;
}

export async function listEnabledEmailAccountRows(
  worldId: number,
  accountId?: number,
): Promise<EmailAccountRow[]> {
  if (accountId != null) return [await resolveEmailAccountRow(worldId, accountId)];
  const accounts = (await listEmailAccountRows(worldId)).filter((a) => a.enabled);
  if (accounts.length === 0) throw new Error("No enabled email accounts configured");
  return accounts;
}
