import {
  EMAIL_ACCOUNT_COMPONENT,
  asEmailAccount,
  type EmailAccountBody,
} from "@freeanima/core/db/schema/entity";

import { defaultEmailWorldId, getEntityStoreForEmail } from "./entity-port.ts";
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
  meta: { created_at: string; updated_at: string },
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
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
}

async function listAccountEntities() {
  const store = getEntityStoreForEmail();
  return store.list({
    world_id: defaultEmailWorldId(),
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    limit: 200,
  });
}

async function normalizeDefaultSender(preferredId?: number): Promise<void> {
  const store = getEntityStoreForEmail();
  const rows = await listAccountEntities();
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
    await store.update({ id: row.id, body: { ...parsed, default_sender: nextDefault } });
  }
}

export async function listEmailAccountRows(): Promise<EmailAccountRow[]> {
  const rows = await listAccountEntities();
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
  const store = getEntityStoreForEmail();
  const row = await store.get(id);
  if (!row) return null;
  const parsed = asEmailAccount(row);
  if (!parsed) return null;
  return toAccountRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function findEmailAccountByAddressAndHost(
  address: string,
  smtpHost: string,
): Promise<EmailAccountRow | null> {
  const accounts = await listEmailAccountRows();
  return accounts.find((a) => a.address === address && a.smtp_host === smtpHost) ?? null;
}

export async function createEmailAccount(input: EmailAccountCreateInput): Promise<EmailAccountRow> {
  const store = getEntityStoreForEmail();
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

  const row = await store.create({
    type: "content",
    world_id: defaultEmailWorldId(),
    components: [EMAIL_ACCOUNT_COMPONENT],
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    title: accountTitle(input),
    body,
  });

  if (body.default_sender) {
    await normalizeDefaultSender(row.id);
  } else {
    await normalizeDefaultSender();
  }

  const refreshed = await getEmailAccountRow(row.id);
  if (!refreshed) throw new Error("failed to load created email account");
  return refreshed;
}

export async function updateEmailAccount(
  input: EmailAccountUpdateInput,
): Promise<EmailAccountRow | null> {
  const store = getEntityStoreForEmail();
  const existing = await getEmailAccountRow(input.id);
  if (!existing) return null;

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

  const row = await store.update({
    id: input.id,
    title: accountTitle({
      display_name: input.display_name ?? existing.display_name,
      address: merged.address,
    }),
    body: merged,
  });
  if (!row) return null;

  if (merged.default_sender) {
    await normalizeDefaultSender(input.id);
  } else {
    await normalizeDefaultSender();
  }

  return getEmailAccountRow(input.id);
}

export async function deleteEmailAccountRow(id: number): Promise<boolean> {
  const store = getEntityStoreForEmail();
  const ok = await store.delete(id);
  if (ok) await normalizeDefaultSender();
  return ok;
}

export async function getDefaultEmailAccountRow(): Promise<EmailAccountRow | null> {
  const accounts = (await listEmailAccountRows()).filter((a) => a.enabled);
  return accounts.find((a) => a.default_sender) ?? accounts[0] ?? null;
}

export async function resolveEmailAccountRow(accountId?: number): Promise<EmailAccountRow> {
  const accounts = (await listEmailAccountRows()).filter((a) => a.enabled);
  if (accounts.length === 0) throw new Error("No enabled email accounts configured");

  if (accountId != null) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`Email account not found or disabled: ${accountId}`);
    return account;
  }

  const fallback = await getDefaultEmailAccountRow();
  if (!fallback) throw new Error("No default sender account found");
  return fallback;
}

export async function listEnabledEmailAccountRows(accountId?: number): Promise<EmailAccountRow[]> {
  if (accountId != null) return [await resolveEmailAccountRow(accountId)];
  const accounts = (await listEmailAccountRows()).filter((a) => a.enabled);
  if (accounts.length === 0) throw new Error("No enabled email accounts configured");
  return accounts;
}
