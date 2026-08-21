import type { ContactRowPayload } from "@freeanima/shared/rpc-contract/frames/contact.ts";
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
  subjectId: number,
  opts?: { query?: string; limit?: number },
): Promise<ContactRow[]> {
  const scope = resolveHabitatCacheScope();
  const q = opts?.query?.trim();
  const cacheId = q ? `search:${subjectId}:${q}` : `list:${subjectId}`;

  return withOfflineCache({
    scope,
    namespace: "contact",
    id: cacheId,
    fetch: async () => {
      if (q) {
        const data = await habitat().call("contact.search", {
          subject_id: subjectId,
          query: q,
          limit: opts?.limit ?? 200,
        });
        return data.items;
      }
      const data = await habitat().call("contact.list", {
        subject_id: subjectId,
        limit: opts?.limit ?? 2000,
      });
      return data.items;
    },
    offlineError: "contact.list unavailable offline",
  });
}

export async function getContactRemote(subjectId: number, id: number): Promise<ContactRow> {
  const data = await habitat().call("contact.get", { subject_id: subjectId, id });
  return data.item;
}

export async function createContactRemote(
  subjectId: number,
  input: {
    title: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactRow["addresses"];
    wechats?: ContactChannelEntry[];
    linked_subject_id?: number | null;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.create", {
    subject_id: subjectId,
    ...input,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function patchContactRemote(
  subjectId: number,
  id: number,
  patch: {
    title?: string;
    summary?: string;
    emails?: ContactChannelEntry[];
    phones?: ContactChannelEntry[];
    addresses?: ContactRow["addresses"];
    wechats?: ContactChannelEntry[];
    linked_subject_id?: number | null;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.patch", {
    subject_id: subjectId,
    id,
    ...patch,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function deleteContactRemote(subjectId: number, id: number): Promise<void> {
  await habitat().call("contact.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["contact"]);
}

export async function resolveContactsByAddress(
  subjectId: number,
  address: string,
): Promise<ContactRow[]> {
  const data = await habitat().call("contact.resolveByAddress", {
    subject_id: subjectId,
    address,
  });
  return data.items;
}

export async function attachAddressRemote(
  subjectId: number,
  input: {
    contact_id: number;
    address: string;
    label?: string;
    identity_key?: boolean;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.attachAddress", {
    subject_id: subjectId,
    ...input,
  });
  await invalidatePortalReads(["contact"]);
  return data.item;
}

export async function createFromAddressRemote(
  subjectId: number,
  input: {
    title: string;
    address: string;
    identity_key?: boolean;
  },
): Promise<ContactRow> {
  const data = await habitat().call("contact.createFromAddress", {
    subject_id: subjectId,
    ...input,
  });
  await invalidatePortalReads(["contact", "email"]);
  return data.item;
}
