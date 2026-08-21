import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  ContactIdentityConflictError,
  attachAddressToContact,
  createContact,
  deleteContact,
  extractEmailAddress,
  getContact,
  listContacts,
  resolveContactsByAddress,
  searchContacts,
  updateContact,
  type ContactAddressEntry,
  type ContactChannelEntry,
} from "../domain/index.ts";
import { assertContactWorldAccess } from "../domain/contact-world.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectIdAllowed(auth: RpcRequestAuthContext, subjectId: number): void {
  if (auth.subject_id === subjectId) return;
  if (auth.subject_type === "user") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function requireSubjectId(subject_id: number | undefined): number {
  if (subject_id == null || !Number.isInteger(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }
  return subject_id;
}

async function contactWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
  access: "read" | "write",
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return assertContactWorldAccess({
    subjectId: auth.subject_id,
    subjectType: auth.subject_type,
    access,
  });
}

function mapIdentityError(e: unknown): never {
  if (e instanceof ContactIdentityConflictError) {
    throw new Error(e.message);
  }
  throw e instanceof Error ? e : new Error(String(e));
}

export async function serviceContactList(
  deps: RuntimeDeps,
  input: { subject_id: number; limit?: number; offset?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "read");
  const items = await listContacts(
    worldId,
    omitUndefined({ limit: input.limit, offset: input.offset }),
  );
  return { items };
}

export async function serviceContactGet(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "read");
  const item = await getContact(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceContactSearch(
  deps: RuntimeDeps,
  input: { subject_id: number; query: string; limit?: number; offset?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "read");
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
    subject_id: number;
    title: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactAddressEntry[];
    wechats?: ContactChannelEntry[];
    linked_subject_id?: number | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "write");
  const { subject_id: _sid, linked_subject_id, ...rest } = input;
  const restWithLink = {
    ...rest,
    ...(linked_subject_id !== undefined ? { subject_id: linked_subject_id } : {}),
  };
  try {
    const item = await createContact(worldId, omitUndefined(restWithLink));
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

export async function serviceContactPatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    title?: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactAddressEntry[];
    wechats?: ContactChannelEntry[];
    linked_subject_id?: number | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "write");
  const { subject_id: _sid, linked_subject_id, ...rest } = input;
  const restWithLink = {
    ...rest,
    ...(linked_subject_id !== undefined ? { subject_id: linked_subject_id } : {}),
  };
  try {
    const item = await updateContact(worldId, omitUndefined(restWithLink));
    if (!item) throw new Error("NOT_FOUND");
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}

export async function serviceContactDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "write");
  const ok = await deleteContact(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceContactResolveByAddress(
  deps: RuntimeDeps,
  input: { subject_id: number; address: string; limit?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "read");
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
    subject_id: number;
    contact_id: number;
    address: string;
    label?: string;
    identity_key?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "write");
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
    subject_id: number;
    title: string;
    address: string;
    label?: string;
    identity_key?: boolean;
    summary?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await contactWorldIdForAuth(auth, input.subject_id, "write");
  try {
    const email = extractEmailAddress(input.address);
    if (!email) throw new Error("invalid email address");
    const item = await createContact(
      worldId,
      omitUndefined({
        title: input.title,
        summary: input.summary ?? email,
        emails: [
          omitUndefined({
            value: email,
            label: input.label,
            identity_key: Boolean(input.identity_key),
          }),
        ],
      }),
    );
    return { item };
  } catch (e) {
    return mapIdentityError(e);
  }
}
