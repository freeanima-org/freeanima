import type { SubjectKind } from "@freeanima/habitat/core/config";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  assertSubjectCanAccessWorld,
  isUserAgentPrivateWorldPassthrough,
} from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import { asEmailMessage, EMAIL_MESSAGE_COMPONENT } from "@freeanima/habitat/core/db/schema/entity";
import { getEntity, updateEntity } from "@freeanima/habitat/core/db/pg/entity";

import {
  ContactIdentityConflictError,
  attachAddressToContact,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  resolveContactsByAddress,
  searchContacts,
  updateContact,
  type ContactAddressEntry,
  type ContactChannelEntry,
} from "../domain/index.ts";
import { resolveContactWorldId } from "../domain/contact-world.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function contactWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind: SubjectKind | undefined,
  access: "read" | "write",
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  const worldId = resolveContactWorldId();
  if (isUserAgentPrivateWorldPassthrough(auth.subject_type, worldId)) {
    // Commons 不是 agent private；此旁路不适用，继续走 grant
  }
  await assertSubjectCanAccessWorld(auth.subject_id, worldId, { access });
  return worldId;
}

function mapIdentityError(e: unknown): never {
  if (e instanceof ContactIdentityConflictError) {
    throw new Error(e.message);
  }
  throw e instanceof Error ? e : new Error(String(e));
}

export async function serviceContactList(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; limit?: number; offset?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "read");
  const items = await listContacts(
    worldId,
    omitUndefined({ limit: input.limit, offset: input.offset }),
  );
  return { items };
}

export async function serviceContactGet(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "read");
  const item = await getContact(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceContactSearch(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; query: string; limit?: number; offset?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "read");
  return searchContacts(
    worldId,
    omitUndefined({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    }),
  );
}

export async function serviceContactCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    title: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactAddressEntry[];
    wechats?: ContactChannelEntry[];
    subject_id?: number | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "write");
  const { subject_kind: _sk, ...rest } = input;
  try {
    const item = await createContact(worldId, omitUndefined(rest));
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

export async function serviceContactPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    id: number;
    title?: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactAddressEntry[];
    wechats?: ContactChannelEntry[];
    subject_id?: number | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "write");
  const { subject_kind: _sk, ...rest } = input;
  try {
    const item = await updateContact(worldId, omitUndefined(rest));
    if (!item) throw new Error("NOT_FOUND");
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

export async function serviceContactDelete(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "write");
  const ok = await deleteContact(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceContactResolveByAddress(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; address: string; limit?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "read");
  const items = await resolveContactsByAddress(
    worldId,
    input.address,
    omitUndefined({ limit: input.limit }),
  );
  return { items };
}

export async function serviceContactAttachAddress(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    contact_id: number;
    address: string;
    label?: string;
    identity_key?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "write");
  try {
    const item = await attachAddressToContact(
      worldId,
      omitUndefined({
        contact_id: input.contact_id,
        address: input.address,
        label: input.label,
        identity_key: input.identity_key,
      }),
    );
    if (!item) throw new Error("NOT_FOUND");
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

export async function serviceContactCreateFromAddress(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    title: string;
    address: string;
    label?: string;
    identity_key?: boolean;
    summary?: string;
    message_id?: number;
    link_role?: "from" | "to";
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_kind, "write");
  try {
    const item = await createContact(
      worldId,
      omitUndefined({
        title: input.title,
        summary: input.summary,
        emails: [
          omitUndefined({
            value: input.address,
            label: input.label,
            identity_key: Boolean(input.identity_key),
          }),
        ],
      }),
    );
    if (input.message_id != null && input.link_role) {
      await linkMessageContacts(auth, {
        message_id: input.message_id,
        role: input.link_role,
        contact_id: item.id,
      });
    }
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

async function linkMessageContacts(
  auth: RpcRequestAuthContext,
  input: {
    message_id: number;
    role: "from" | "to";
    contact_id: number | null;
    to_contact_ids?: number[];
  },
): Promise<{ from_contact_id: number | null; to_contact_ids: number[] }> {
  const entity = await getEntity(input.message_id);
  if (!entity || entity.primary_component !== EMAIL_MESSAGE_COMPONENT) {
    throw new Error("NOT_FOUND");
  }
  if (!isUserAgentPrivateWorldPassthrough(auth.subject_type, entity.world_id)) {
    await assertSubjectCanAccessWorld(auth.subject_id, entity.world_id, { access: "write" });
  }
  const parsed = asEmailMessage(entity);
  if (!parsed) throw new Error("NOT_FOUND");

  let from_contact_id = parsed.from_contact_id ?? null;
  let to_contact_ids = [...(parsed.to_contact_ids ?? [])];

  if (input.role === "from") {
    from_contact_id = input.contact_id;
  } else if (input.to_contact_ids) {
    to_contact_ids = [...input.to_contact_ids];
  } else if (input.contact_id == null) {
    to_contact_ids = [];
  } else if (!to_contact_ids.includes(input.contact_id)) {
    to_contact_ids.push(input.contact_id);
  }

  await updateEntity({
    id: input.message_id,
    body: {
      ...entity.body,
      from_contact_id,
      to_contact_ids,
    },
  });
  return { from_contact_id, to_contact_ids };
}

export async function serviceContactLinkMessage(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    message_id: number;
    role: "from" | "to";
    contact_id: number | null;
    to_contact_ids?: number[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  resolveSubjectKind(input.subject_kind);
  assertSubjectKindMatches(auth, input.subject_kind);
  // 读 Commons 非必须；写的是邮件所在 world
  return linkMessageContacts(auth, {
    message_id: input.message_id,
    role: input.role,
    contact_id: input.contact_id,
    ...(input.to_contact_ids ? { to_contact_ids: input.to_contact_ids } : {}),
  });
}
