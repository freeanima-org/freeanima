import {
  EMAIL_ACCOUNT_COMPONENT,
  TAG_COMPONENT,
  asEmailAccount,
  type EmailAccountBody,
  type EntityRow,
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
import { normalizeAccountSync } from "./sync-state.ts";
import type { EmailAccountCreateInput, EmailAccountRow, EmailAccountUpdateInput } from "./types.ts";

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function assertTagIdsInWorld(worldId: number, tagIds: number[]): Promise<void> {
  for (const id of tagIds) {
    const row = await getEntity(id);
    if (!row || row.primary_component !== TAG_COMPONENT) {
      throw new Error(`tag not found: ${id}`);
    }
    await assertEntityInWorld(id, worldId);
  }
}

function accountTitle(input: { display_name?: string; address: string }): string {
  return (input.display_name?.trim() || input.address.trim()).slice(0, 500);
}

function toAccountRow(
  row: NonNullable<ReturnType<typeof asEmailAccount>>,
  entity: Pick<EntityRow, "created_at" | "updated_at" | "tag_ids">,
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
    tag_ids: [...(entity.tag_ids ?? [])],
    ...(row.sync
      ? {
          sync: normalizeAccountSync(
            row.sync,
          ) as import("@freeanima/host/core/db/schema/entity").EmailAccountSync,
        }
      : {}),
    ...(row.mailbox_paths !== undefined ? { mailbox_paths: row.mailbox_paths } : {}),
    ...(row.sent_mailbox !== undefined ? { sent_mailbox: row.sent_mailbox } : {}),
    ...(row.trash_mailbox !== undefined ? { trash_mailbox: row.trash_mailbox } : {}),
    ...(row.drafts_mailbox !== undefined ? { drafts_mailbox: row.drafts_mailbox } : {}),
    ...(row.delete_policy !== undefined ? { delete_policy: row.delete_policy } : {}),
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
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
      return parsed ? toAccountRow(parsed, row) : null;
    })
    .filter((row): row is EmailAccountRow => row != null)
    .toSorted((a, b) => a.id - b.id);
}

export async function getEmailAccountRow(id: number): Promise<EmailAccountRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailAccount(row);
  if (!parsed) return null;
  return toAccountRow(parsed, row);
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
  const tagIds = normalizeTagIds(input.tag_ids);
  await assertTagIdsInWorld(worldId, tagIds);
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
    sync: { mailboxes: { INBOX: { special_use: "inbox" } } },
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [EMAIL_ACCOUNT_COMPONENT],
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    title: accountTitle(input),
    body,
    tag_ids: tagIds,
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
  const existingEntity = await getEntity(input.id);
  if (!existingEntity) return null;
  await assertEntityInWorld(input.id, worldId);
  const existingParsed = asEmailAccount(existingEntity);
  if (!existingParsed) return null;
  const existing = toAccountRow(existingParsed, existingEntity);

  let nextTagIds = existingEntity.tag_ids ?? [];
  if (input.tag_ids !== undefined) {
    nextTagIds = normalizeTagIds(input.tag_ids);
    await assertTagIdsInWorld(worldId, nextTagIds);
  }

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
    sync: input.sync ?? existing.sync,
    mailbox_paths: input.mailbox_paths ?? existing.mailbox_paths,
    delete_policy: input.delete_policy ?? existing.delete_policy,
  };
  const mergedRecord = merged as Record<string, unknown>;
  for (const key of ["sent_mailbox", "trash_mailbox", "drafts_mailbox"] as const) {
    const value = input[key];
    if (value === null) {
      delete mergedRecord[key];
    } else if (value !== undefined) {
      mergedRecord[key] = value;
    } else if (existing[key] !== undefined) {
      mergedRecord[key] = existing[key];
    }
  }

  const row = await updateEntity({
    id: input.id,
    title: accountTitle({
      display_name: input.display_name ?? existing.display_name,
      address: merged.address,
    }),
    body: mergedRecord,
    ...(input.tag_ids !== undefined ? { tag_ids: nextTagIds } : {}),
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

/** 跨所有 world 列出已启用邮箱账户（内置 cron / IDLE） */
export async function listAllEnabledEmailAccountRows(): Promise<EmailAccountRow[]> {
  const rows = await listEntities({
    primary_component: EMAIL_ACCOUNT_COMPONENT,
    limit: 500,
  });
  return rows
    .map((row) => {
      const parsed = asEmailAccount(row);
      return parsed ? toAccountRow(parsed, row) : null;
    })
    .filter((row): row is EmailAccountRow => row != null && row.enabled)
    .toSorted((a, b) => a.id - b.id);
}
