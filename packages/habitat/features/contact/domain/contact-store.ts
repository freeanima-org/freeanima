import {
  CONTACT_COMPONENT,
  asContact,
  contactPrimaryLocalSubjectId,
  type ContactAddressEntry,
  type ContactAnimaEntry,
  type ContactBody,
  type ContactChannelEntry,
  type ContactChannelKind,
  normalizeContactChannelValue,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import type {
  ContactAttachAddressInput,
  ContactCreateInput,
  ContactListOpts,
  ContactRow,
  ContactSearchOpts,
  ContactUpdateInput,
} from "./types.ts";

export class ContactIdentityConflictError extends Error {
  override name = "ContactIdentityConflictError";
  constructor(
    readonly channel: ContactChannelKind,
    readonly value: string,
    readonly existingContactId: number,
  ) {
    super(`identity_key conflict: ${channel}=${value} already on contact ${existingContactId}`);
  }
}

function toContactRow(row: NonNullable<ReturnType<typeof asContact>>): ContactRow {
  const animas = row.animas ?? [];
  const subject_id = contactPrimaryLocalSubjectId({
    emails: row.emails ?? [],
    phones: row.phones ?? [],
    addresses: row.addresses ?? [],
    wechats: row.wechats ?? [],
    animas,
    subject_id: row.subject_id ?? null,
  });
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    emails: row.emails ?? [],
    phones: row.phones ?? [],
    addresses: row.addresses ?? [],
    wechats: row.wechats ?? [],
    animas,
    subject_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function assertContactInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  worldId: number,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== CONTACT_COMPONENT) return false;
  return existing.world_id === worldId;
}

function normalizeEntries(
  kind: Exclude<ContactChannelKind, "address">,
  entries: ContactChannelEntry[] | undefined,
): ContactChannelEntry[] {
  if (!entries) return [];
  return entries.map((e) => {
    const trimmed = e.value.trim();
    const value =
      kind === "email"
        ? (extractEmailAddress(trimmed) ?? normalizeContactChannelValue("email", trimmed))
        : normalizeContactChannelValue(kind, trimmed);
    return {
      value,
      ...(e.label != null && e.label !== "" ? { label: e.label } : {}),
      identity_key: e.identity_key,
    };
  });
}

function normalizeAddresses(entries: ContactAddressEntry[] | undefined): ContactAddressEntry[] {
  if (!entries) return [];
  return entries.map((e) => ({
    value: e.value.trim(),
    ...(e.label != null && e.label !== "" ? { label: e.label } : {}),
    identity_key: false as const,
  }));
}

function buildBody(input: {
  emails?: ContactChannelEntry[];
  phones?: ContactChannelEntry[];
  addresses?: ContactAddressEntry[];
  wechats?: ContactChannelEntry[];
  animas?: ContactAnimaEntry[];
  subject_id?: number | null;
}): ContactBody {
  const animas = input.animas ?? [];
  const localSubject =
    animas.find((a): a is Extract<ContactAnimaEntry, { kind: "local" }> => a.kind === "local")
      ?.subject_id ??
    input.subject_id ??
    null;
  return {
    emails: normalizeEntries("email", input.emails),
    phones: normalizeEntries("phone", input.phones),
    addresses: normalizeAddresses(input.addresses),
    wechats: normalizeEntries("wechat", input.wechats),
    animas,
    subject_id: localSubject,
  };
}

function contentSummary(body: ContactBody): string {
  const parts = [
    ...body.emails.map((e) => e.value),
    ...body.phones.map((e) => e.value),
    ...body.wechats.map((e) => e.value),
  ];
  return parts.slice(0, 8).join(", ");
}

async function listAllContacts(worldId: number): Promise<ContactRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTACT_COMPONENT,
    limit: 5000,
    offset: 0,
    mode: "filter_only",
    include_count: false,
  });
  return result.results
    .map((row) => {
      const parsed = asContact(row);
      return parsed ? toContactRow(parsed) : null;
    })
    .filter((row): row is ContactRow => row != null);
}

function collectIdentityKeys(row: ContactRow): Array<{ kind: ContactChannelKind; value: string }> {
  const out: Array<{ kind: ContactChannelKind; value: string }> = [];
  for (const e of row.emails) {
    if (e.identity_key)
      out.push({ kind: "email", value: normalizeContactChannelValue("email", e.value) });
  }
  for (const e of row.phones) {
    if (e.identity_key)
      out.push({ kind: "phone", value: normalizeContactChannelValue("phone", e.value) });
  }
  for (const e of row.wechats) {
    if (e.identity_key) {
      out.push({ kind: "wechat", value: normalizeContactChannelValue("wechat", e.value) });
    }
  }
  return out;
}

async function assertNoIdentityConflict(
  worldId: number,
  body: ContactBody,
  excludeId?: number,
): Promise<void> {
  const candidate: ContactRow = {
    id: excludeId ?? 0,
    title: "",
    summary: "",
    emails: body.emails,
    phones: body.phones,
    addresses: body.addresses,
    wechats: body.wechats,
    animas: body.animas ?? [],
    subject_id: body.subject_id ?? null,
    created_at: "",
    updated_at: "",
  };
  const keys = collectIdentityKeys(candidate);
  if (keys.length === 0) return;
  const all = await listAllContacts(worldId);
  for (const other of all) {
    if (excludeId != null && other.id === excludeId) continue;
    const otherKeys = collectIdentityKeys(other);
    for (const key of keys) {
      const hit = otherKeys.find((k) => k.kind === key.kind && k.value === key.value);
      if (hit) throw new ContactIdentityConflictError(key.kind, key.value, other.id);
    }
  }
}

export async function listContacts(
  worldId: number,
  opts: ContactListOpts = {},
): Promise<ContactRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTACT_COMPONENT,
    limit: opts.limit ?? 2000,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });
  return result.results
    .map((row) => {
      const parsed = asContact(row);
      return parsed ? toContactRow(parsed) : null;
    })
    .filter((row): row is ContactRow => row != null)
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

export async function getContact(worldId: number, id: number): Promise<ContactRow | null> {
  const existing = await getEntity(id);
  if (!assertContactInWorld(existing, worldId)) return null;
  const parsed = asContact(existing);
  return parsed ? toContactRow(parsed) : null;
}

export async function searchContacts(
  worldId: number,
  opts: ContactSearchOpts,
): Promise<{ items: ContactRow[]; count: number }> {
  const query = opts.query.trim();
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTACT_COMPONENT,
    query,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    mode: "hybrid",
  });
  const items = result.results
    .map((row) => {
      const parsed = asContact(row);
      return parsed ? toContactRow(parsed) : null;
    })
    .filter((row): row is ContactRow => row != null);
  return { items, count: result.count };
}

/** 从展示串提取邮箱：`Name <a@b.com>` 或纯地址。 */
export function extractEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim();
  if (!candidate.includes("@")) return null;
  return normalizeContactChannelValue("email", candidate);
}

/** 从 `Name <a@b.com>` / `"Name" <a@b.com>` 提取显示名；纯地址则返回 null。 */
export function extractMailboxDisplayName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("<")) return null;
  const before = trimmed.split("<")[0]?.trim() ?? "";
  const unquoted = before.replace(/^"|"$/g, "").trim();
  return unquoted || null;
}

export async function resolveContactsByAddress(
  worldId: number,
  address: string,
  opts?: { limit?: number },
): Promise<ContactRow[]> {
  const normalized = extractEmailAddress(address) ?? normalizeContactChannelValue("email", address);
  if (!normalized) return [];
  const all = await listAllContacts(worldId);
  const identityHits: ContactRow[] = [];
  const otherHits: ContactRow[] = [];
  for (const row of all) {
    for (const e of row.emails) {
      if (normalizeContactChannelValue("email", e.value) !== normalized) continue;
      if (e.identity_key) identityHits.push(row);
      else otherHits.push(row);
      break;
    }
  }
  const merged = [
    ...identityHits,
    ...otherHits.filter((r) => !identityHits.some((i) => i.id === r.id)),
  ];
  return merged.slice(0, opts?.limit ?? 20);
}

export async function createContact(
  worldId: number,
  input: ContactCreateInput,
): Promise<ContactRow> {
  if (input.client_op_id) {
    const byOp = await findByClientOpId(worldId, input.client_op_id);
    if (byOp) return byOp;
  }
  const body = buildBody({
    ...(input.emails != null ? { emails: input.emails } : {}),
    ...(input.phones != null ? { phones: input.phones } : {}),
    ...(input.addresses != null ? { addresses: input.addresses } : {}),
    ...(input.wechats != null ? { wechats: input.wechats } : {}),
    ...(input.animas != null ? { animas: input.animas } : {}),
    ...(input.subject_id !== undefined ? { subject_id: input.subject_id } : {}),
  });
  await assertNoIdentityConflict(worldId, body);
  const title = input.title.trim() || "未命名联系人";
  const summary = (input.summary ?? contentSummary(body)).trim();
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [CONTACT_COMPONENT],
    primary_component: CONTACT_COMPONENT,
    title,
    summary,
    content: contentSummary(body),
    body,
    client_op_id: input.client_op_id ?? null,
  });
  const parsed = asContact(row);
  if (!parsed) throw new Error("contact create parse failed");
  return toContactRow(parsed);
}

export async function updateContact(
  worldId: number,
  input: ContactUpdateInput,
): Promise<ContactRow | null> {
  const existing = await getEntity(input.id);
  if (!assertContactInWorld(existing, worldId)) return null;
  const current = asContact(existing);
  if (!current) return null;

  const body = buildBody({
    emails: input.emails ?? current.emails,
    phones: input.phones ?? current.phones,
    addresses: input.addresses ?? current.addresses,
    wechats: input.wechats ?? current.wechats,
    animas: input.animas ?? current.animas ?? [],
    subject_id: input.subject_id !== undefined ? input.subject_id : (current.subject_id ?? null),
  });
  await assertNoIdentityConflict(worldId, body, input.id);

  const title = input.title != null ? input.title.trim() || current.title : current.title;
  const summary =
    input.summary != null ? input.summary.trim() : current.summary || contentSummary(body);

  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title,
      summary,
      content: contentSummary(body),
      body,
    }),
  );
  if (!updated) return null;
  const parsed = asContact(updated);
  return parsed ? toContactRow(parsed) : null;
}

export async function deleteContact(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertContactInWorld(existing, worldId)) return false;
  await deleteEntity(id);
  return true;
}

export async function attachAddressToContact(
  worldId: number,
  input: ContactAttachAddressInput,
): Promise<ContactRow | null> {
  const existing = await getContact(worldId, input.contact_id);
  if (!existing) return null;
  const addr = extractEmailAddress(input.address);
  if (!addr) throw new Error("invalid email address");
  const normalized = addr;
  const emails = [...existing.emails];
  const idx = emails.findIndex(
    (e) => normalizeContactChannelValue("email", e.value) === normalized,
  );
  const entry: ContactChannelEntry = {
    value: normalized,
    ...(input.label ? { label: input.label } : {}),
    identity_key: Boolean(input.identity_key),
  };
  if (idx >= 0) emails[idx] = { ...emails[idx], ...entry };
  else emails.push(entry);
  return updateContact(worldId, {
    id: input.contact_id,
    emails,
  });
}

function findByClientOpId(worldId: number, clientOpId: string): Promise<ContactRow | null> {
  return searchEntities({
    world_id: worldId,
    primary_component: CONTACT_COMPONENT,
    limit: 5000,
    mode: "filter_only",
    include_count: false,
  }).then((result) => {
    for (const row of result.results) {
      const parsed = asContact(row);
      if (!parsed) continue;
      if (parsed.client_op_id === clientOpId) return toContactRow(parsed);
    }
    return null;
  });
}

/** 按 anima public_id 解析联系人（无则 null）。 */
export async function resolveContactByPublicId(
  worldId: number,
  publicId: string,
): Promise<ContactRow | null> {
  const id = publicId.trim();
  if (!id) return null;
  const all = await listAllContacts(worldId);
  for (const row of all) {
    if ((row.animas ?? []).some((a) => a.public_id === id)) return row;
  }
  return null;
}

/**
 * 本机 subject 创建后 ensure 对应 Contact（Commons）。
 * 已存在同 public_id / subject_id 则补齐 local anima，不重复建。
 */
export async function ensureContactForLocalSubject(input: {
  worldId: number;
  subjectId: number;
  publicId: string;
  publicKey?: string;
  title: string;
}): Promise<ContactRow> {
  const existingByPublic = await resolveContactByPublicId(input.worldId, input.publicId);
  if (existingByPublic) {
    const hasLocal = (existingByPublic.animas ?? []).some(
      (a) => a.kind === "local" && a.public_id === input.publicId,
    );
    if (hasLocal) return existingByPublic;
    const animas: ContactAnimaEntry[] = [
      ...(existingByPublic.animas ?? []),
      {
        kind: "local",
        public_id: input.publicId,
        subject_id: input.subjectId,
        ...(input.publicKey ? { public_key: input.publicKey } : {}),
      },
    ];
    const updated = await updateContact(input.worldId, {
      id: existingByPublic.id,
      animas,
      subject_id: input.subjectId,
    });
    if (!updated) throw new Error("ensureContactForLocalSubject patch failed");
    return updated;
  }

  const all = await listAllContacts(input.worldId);
  const bySubject = all.find((r) => r.subject_id === input.subjectId);
  if (bySubject) {
    const animas: ContactAnimaEntry[] = [
      ...(bySubject.animas ?? []).filter(
        (a) => !(a.kind === "local" && a.subject_id === input.subjectId),
      ),
      {
        kind: "local",
        public_id: input.publicId,
        subject_id: input.subjectId,
        ...(input.publicKey ? { public_key: input.publicKey } : {}),
      },
    ];
    const updated = await updateContact(input.worldId, {
      id: bySubject.id,
      animas,
      subject_id: input.subjectId,
    });
    if (!updated) throw new Error("ensureContactForLocalSubject subject patch failed");
    return updated;
  }

  return createContact(input.worldId, {
    title: input.title.trim() || input.publicId,
    subject_id: input.subjectId,
    animas: [
      {
        kind: "local",
        public_id: input.publicId,
        subject_id: input.subjectId,
        ...(input.publicKey ? { public_key: input.publicKey } : {}),
      },
    ],
  });
}
