import {
  attachToolReturns,
  toolError,
  toolResult,
  getToolCallerAuth,
  resolveToolCallerSubjectId,
} from "@freeanima/habitat/core/tool";
import { ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { coerceString } from "@freeanima/shared/coerce-string";
import { omitUndefined } from "@freeanima/habitat/core/util";

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
} from "./contact-store.ts";
import { assertContactWorldAccess } from "./contact-world.ts";
import { CONTACT_TOOL_RETURNS } from "./return-schemas.ts";

async function assertContactAccess(access: "read" | "write"): Promise<number | string> {
  try {
    const auth = getToolCallerAuth();
    return await assertContactWorldAccess({
      subjectId: resolveToolCallerSubjectId(),
      subjectType: auth?.subject_type,
      access,
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

function parseChannelEntries(
  raw: unknown,
): Array<{ value: string; label?: string; identity_key?: boolean }> | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{ value: string; label?: string; identity_key?: boolean }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const value = coerceString(rec.value)?.trim();
    if (!value) continue;
    out.push(
      omitUndefined({
        value,
        label: coerceString(rec.label) ?? undefined,
        identity_key: rec.identity_key === true ? true : undefined,
      }),
    );
  }
  return out;
}

function contactPayload(row: {
  id: number;
  title: string;
  summary: string;
  emails: unknown;
  phones: unknown;
  addresses: unknown;
  wechats: unknown;
  subject_id: number | null;
}) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    emails: row.emails,
    phones: row.phones,
    addresses: row.addresses,
    wechats: row.wechats,
    subject_id: row.subject_id,
  };
}

export function buildContactToolDefs() {
  return attachToolReturns(
    [
      {
        name: "contact_list",
        description: "List contacts in Commons address book",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            offset: { type: "integer" },
          },
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("read");
          if (typeof worldId === "string") return worldId;
          const items = await listContacts(
            worldId,
            omitUndefined({
              limit: typeof args.limit === "number" ? args.limit : undefined,
              offset: typeof args.offset === "number" ? args.offset : undefined,
            }),
          );
          return toolResult({
            ok: true,
            action: "list",
            count: items.length,
            contacts: items.map(contactPayload),
          });
        },
      },
      {
        name: "contact_get",
        description: "Get one contact by id",
        parameters: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("read");
          if (typeof worldId === "string") return worldId;
          const id = Number(args.id);
          if (!Number.isFinite(id) || id <= 0) return toolError("id required");
          const item = await getContact(worldId, id);
          if (!item) return toolError("NOT_FOUND");
          return toolResult({ ok: true, action: "get", contact: contactPayload(item) });
        },
      },
      {
        name: "contact_search",
        description: "Search contacts by title / channel values",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["query"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("read");
          if (typeof worldId === "string") return worldId;
          const query = coerceString(args.query)?.trim();
          if (!query) return toolError("query required");
          const result = await searchContacts(
            worldId,
            omitUndefined({
              query,
              limit: typeof args.limit === "number" ? args.limit : undefined,
            }),
          );
          return toolResult({
            ok: true,
            action: "search",
            count: result.count,
            contacts: result.items.map(contactPayload),
          });
        },
      },
      {
        name: "contact_create",
        description:
          "Create a contact in Commons (user: always allowed; agent: requires Commons write grant)",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            emails: { type: "array", items: { type: "object" } },
            phones: { type: "array", items: { type: "object" } },
            addresses: { type: "array", items: { type: "object" } },
            wechats: { type: "array", items: { type: "object" } },
            subject_id: { type: "integer" },
          },
          required: ["title"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("write");
          if (typeof worldId === "string") return worldId;
          const title = coerceString(args.title)?.trim();
          if (!title) return toolError("title required");
          try {
            const item = await createContact(
              worldId,
              omitUndefined({
                title,
                summary: coerceString(args.summary) ?? undefined,
                emails: parseChannelEntries(args.emails),
                phones: parseChannelEntries(args.phones),
                addresses: parseChannelEntries(args.addresses),
                wechats: parseChannelEntries(args.wechats),
                subject_id:
                  typeof args.subject_id === "number" && args.subject_id > 0
                    ? args.subject_id
                    : undefined,
              }),
            );
            return toolResult({ ok: true, action: "create", contact: contactPayload(item) });
          } catch (e) {
            if (e instanceof ContactIdentityConflictError) return toolError(e.message);
            throw e;
          }
        },
      },
      {
        name: "contact_patch",
        description: "Patch a contact in Commons",
        parameters: {
          type: "object",
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            summary: { type: "string" },
            emails: { type: "array", items: { type: "object" } },
            phones: { type: "array", items: { type: "object" } },
            addresses: { type: "array", items: { type: "object" } },
            wechats: { type: "array", items: { type: "object" } },
            subject_id: { type: "integer", nullable: true },
          },
          required: ["id"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("write");
          if (typeof worldId === "string") return worldId;
          const id = Number(args.id);
          if (!Number.isFinite(id) || id <= 0) return toolError("id required");
          try {
            const item = await updateContact(
              worldId,
              omitUndefined({
                id,
                title: coerceString(args.title) ?? undefined,
                summary: coerceString(args.summary) ?? undefined,
                emails: parseChannelEntries(args.emails),
                phones: parseChannelEntries(args.phones),
                addresses: parseChannelEntries(args.addresses),
                wechats: parseChannelEntries(args.wechats),
                subject_id:
                  args.subject_id === null
                    ? null
                    : typeof args.subject_id === "number" && args.subject_id > 0
                      ? args.subject_id
                      : undefined,
              }),
            );
            if (!item) return toolError("NOT_FOUND");
            return toolResult({ ok: true, action: "patch", contact: contactPayload(item) });
          } catch (e) {
            if (e instanceof ContactIdentityConflictError) return toolError(e.message);
            throw e;
          }
        },
      },
      {
        name: "contact_delete",
        description: "Soft-delete a contact in Commons",
        parameters: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("write");
          if (typeof worldId === "string") return worldId;
          const id = Number(args.id);
          if (!Number.isFinite(id) || id <= 0) return toolError("id required");
          const ok = await deleteContact(worldId, id);
          if (!ok) return toolError("NOT_FOUND");
          return toolResult({ ok: true, action: "delete", id });
        },
      },
      {
        name: "contact_resolve_by_address",
        description:
          "Resolve email address to contact candidates (identity_key matches first). Does not write.",
        parameters: {
          type: "object",
          properties: {
            address: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["address"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("read");
          if (typeof worldId === "string") return worldId;
          const address = coerceString(args.address)?.trim();
          if (!address) return toolError("address required");
          const items = await resolveContactsByAddress(
            worldId,
            address,
            omitUndefined({
              limit: typeof args.limit === "number" ? args.limit : undefined,
            }),
          );
          return toolResult({
            ok: true,
            action: "resolve",
            count: items.length,
            contacts: items.map(contactPayload),
          });
        },
      },
      {
        name: "contact_attach_address",
        description: "Attach an email address to an existing contact (optional identity_key)",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "integer" },
            address: { type: "string" },
            label: { type: "string" },
            identity_key: { type: "boolean" },
          },
          required: ["contact_id", "address"],
        },
        handler: async (args) => {
          const worldId = await assertContactAccess("write");
          if (typeof worldId === "string") return worldId;
          const contact_id = Number(args.contact_id);
          const address = coerceString(args.address)?.trim();
          if (!Number.isFinite(contact_id) || contact_id <= 0 || !address) {
            return toolError("contact_id and address required");
          }
          try {
            const item = await attachAddressToContact(
              worldId,
              omitUndefined({
                contact_id,
                address,
                label: coerceString(args.label) ?? undefined,
                identity_key: args.identity_key === true ? true : undefined,
              }),
            );
            if (!item) return toolError("NOT_FOUND");
            return toolResult({ ok: true, action: "attach", contact: contactPayload(item) });
          } catch (e) {
            if (e instanceof ContactIdentityConflictError) return toolError(e.message);
            return toolError(e instanceof Error ? e.message : String(e));
          }
        },
      },
    ],
    CONTACT_TOOL_RETURNS,
  );
}

export function registerContactTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("contact", "通讯录联系人", buildContactToolDefs());
}
