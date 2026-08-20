import type { ContactRowPayload } from "@freeanima/shared/rpc-contract/frames/contact.ts";
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

export type ContactRow = ContactRowPayload;
export type ContactChannelEntry = ContactRow["emails"][number];

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchContacts(
  subjectKind: SubjectKind,
  opts?: { query?: string; limit?: number },
): Promise<ContactRow[]> {
  const scope = resolveHabitatCacheScope();
  const q = opts?.query?.trim();
  const cacheId = q ? `search:${subjectKind}:${q}` : `list:${subjectKind}`;

  return withOfflineCache({
    scope,
    namespace: "contact",
    id: cacheId,
    fetch: async () => {
      if (q) {
        const data = await habitat().call("contact.search", {
          subject_kind: subjectKind,
          query: q,
          limit: opts?.limit ?? 200,
        });
        return data.items;
      }
      const data = await habitat().call("contact.list", {
        subject_kind: subjectKind,
        limit: opts?.limit ?? 2000,
      });
      return data.items;
    },
    offlineError: "contact.list unavailable offline",
  });
}

export async function getContactRemote(subjectKind: SubjectKind, id: number): Promise<ContactRow> {
  const data = await habitat().call("contact.get", { subject_kind: subjectKind, id });
  return data.item;
}

export async function createContactRemote(
  subjectKind: SubjectKind,
  input: {
    title: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactRow["addresses"];
    wechats?: ContactChannelEntry[];
    subject_id?: number | null;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.create", {
    subject_kind: subjectKind,
    ...input,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function patchContactRemote(
  subjectKind: SubjectKind,
  id: number,
  patch: {
    title?: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactRow["addresses"];
    wechats?: ContactChannelEntry[];
    subject_id?: number | null;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.patch", {
    subject_kind: subjectKind,
    id,
    ...patch,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function deleteContactRemote(subjectKind: SubjectKind, id: number): Promise<void> {
  await habitat().call("contact.delete", { subject_kind: subjectKind, id });
  await invalidatePortalReads(["contact"]);
}

export async function resolveContactsByAddress(
  subjectKind: SubjectKind,
  address: string,
): Promise<ContactRow[]> {
  const data = await habitat().call("contact.resolveByAddress", {
    subject_kind: subjectKind,
    address,
  });
  return data.items;
}

export async function attachAddressRemote(
  subjectKind: SubjectKind,
  input: {
    contact_id: number;
    address: string;
    label?: string;
    identity_key?: boolean;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.attachAddress", {
    subject_kind: subjectKind,
    ...input,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function createFromAddressRemote(
  subjectKind: SubjectKind,
  input: {
    title: string;
    address: string;
    identity_key?: boolean;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.createFromAddress", {
    subject_kind: subjectKind,
    ...input,
  });
  await invalidatePortalReads(["contact", "email"]);
  return data.item;
}
