import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { assertPathAllowed, resolveToolPath } from "@freeanima/host/capabilities/tools/path-policy";

import {
  createObjectFile,
  deleteObjectFile,
  downloadObjectFileBytes,
  getObjectFile,
  listObjectFiles,
} from "./file-store.ts";
import {
  addFileToObjectFolder,
  createObjectFolder,
  deleteObjectFolder,
  listObjectFolders,
  removeFileFromObjectFolder,
} from "./folder-store.ts";
import { OBJECT_STORAGE_TOOL_RETURNS } from "./return-schemas.ts";

const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer",
    description: "Optional world override; otherwise subject_kind selects the private world",
  },
  subject_kind: {
    type: "string",
    enum: ["user", "agent"],
    description: "Owning subject when world_id omitted (user|agent)",
  },
} as const;

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function parseId(raw: unknown): number | null {
  return parseWorldId(raw);
}

async function resolveWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const subjectKind = parseSubjectKind(opts.args.subject_kind);
    const access = opts.access ?? "read";
    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
    }
    if (opts.entityId != null && opts.entityId > 0) {
      return await resolveToolWorld({ entityId: opts.entityId, access });
    }
    if (subjectKind == null) {
      return toolError("subject_kind is required (user|agent) when world_id omitted");
    }
    return await resolveToolWorld({ subjectKind, access });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

function guessMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".vrm")) return "model/vrm";
  if (lower.endsWith(".vrma")) return "application/octet-stream";
  return "application/octet-stream";
}

export function registerObjectStorageTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "object_storage",
    "Content-addressed object storage (object_file / object_folder); local cache + optional S3",
    attachToolReturns(
      [
        {
          name: "object_storage_upload",
          description: "Upload a local file into object storage and create an object_file entity",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Local filesystem path to upload" },
              title: { type: "string", description: "Display title (default: basename)" },
              mime_type: { type: "string" },
              ...WORLD_ID_OPTIONAL,
            },
            required: ["path"],
          },
          handler: async (args) => {
            const pathRaw = String(args.path ?? "");
            if (!pathRaw.trim()) return toolError("path is required");
            const resolved = resolveToolPath(pathRaw);
            const deny = assertPathAllowed(resolved, "read");
            if (deny) return toolError(deny);
            const world = await resolveWorld({ args, access: "write" });
            if (typeof world === "string") return world;
            try {
              const bytes = new Uint8Array(await readFile(resolved));
              const base = resolved.split(/[/\\]/).pop() || "file";
              const item = await createObjectFile({
                world_id: world,
                title: String(args.title ?? base),
                bytes,
                mime_type: args.mime_type != null ? String(args.mime_type) : guessMime(resolved),
              });
              return toolResult({ ok: true, action: "upload", item });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_download",
          description: "Download object_file bytes to a local path",
          parameters: {
            type: "object",
            properties: {
              id: { type: "integer", description: "object_file entity id" },
              path: { type: "string", description: "Destination local path" },
            },
            required: ["id", "path"],
          },
          handler: async (args) => {
            const id = parseId(args.id);
            if (id == null) return toolError("id is required");
            const pathRaw = String(args.path ?? "");
            if (!pathRaw.trim()) return toolError("path is required");
            const resolved = resolveToolPath(pathRaw);
            const deny = assertPathAllowed(resolved, "write");
            if (deny) return toolError(deny);
            const world = await resolveWorld({ args, entityId: id, access: "read" });
            if (typeof world === "string") return world;
            try {
              const { file, bytes } = await downloadObjectFileBytes(id);
              if (file.world_id !== world) return toolError("cross-world access denied");
              await mkdir(dirname(resolved), { recursive: true });
              await writeFile(resolved, bytes);
              return toolResult({ ok: true, action: "download", path: resolved, item: file });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_list",
          description: "List object_file entities in a world",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer" },
              offset: { type: "integer" },
              ...WORLD_ID_OPTIONAL,
            },
            required: [],
          },
          handler: async (args) => {
            const world = await resolveWorld({ args, access: "read" });
            if (typeof world === "string") return world;
            try {
              const items = await listObjectFiles({
                world_id: world,
                limit: args.limit != null ? Number(args.limit) : 50,
                offset: args.offset != null ? Number(args.offset) : 0,
              });
              return toolResult({ ok: true, action: "list", count: items.length, items });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_delete",
          description:
            "Soft-delete an object_file entity (blob kept for restore; GC'd on purge after retention)",
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: async (args) => {
            const id = parseId(args.id);
            if (id == null) return toolError("id is required");
            const world = await resolveWorld({ args, entityId: id, access: "write" });
            if (typeof world === "string") return world;
            try {
              const file = await getObjectFile(id);
              if (!file) return toolError("object_file not found");
              if (file.world_id !== world) return toolError("cross-world access denied");
              await deleteObjectFile(id);
              return toolResult({ ok: true, action: "delete", id });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_folder_create",
          description: "Create an object_folder container",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              parent_id: { type: "integer", description: "Optional parent object_folder id" },
              ...WORLD_ID_OPTIONAL,
            },
            required: ["title"],
          },
          handler: async (args) => {
            const world = await resolveWorld({ args, access: "write" });
            if (typeof world === "string") return world;
            try {
              const item = await createObjectFolder({
                world_id: world,
                title: String(args.title ?? ""),
                parent_id: args.parent_id != null ? Number(args.parent_id) : null,
              });
              return toolResult({ ok: true, action: "folder_create", item });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_folder_list",
          description: "List object_folder entities",
          parameters: {
            type: "object",
            properties: {
              parent_id: { type: "integer", description: "Filter by parent; omit for all" },
              ...WORLD_ID_OPTIONAL,
            },
            required: [],
          },
          handler: async (args) => {
            const world = await resolveWorld({ args, access: "read" });
            if (typeof world === "string") return world;
            try {
              const items = await listObjectFolders({
                world_id: world,
                ...(args.parent_id !== undefined
                  ? { parent_id: args.parent_id == null ? null : Number(args.parent_id) }
                  : {}),
              });
              return toolResult({ ok: true, action: "folder_list", count: items.length, items });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_folder_add_file",
          description: "Append object_file id to object_folder.file_ids",
          parameters: {
            type: "object",
            properties: {
              folder_id: { type: "integer" },
              file_id: { type: "integer" },
            },
            required: ["folder_id", "file_id"],
          },
          handler: async (args) => {
            const folderId = parseId(args.folder_id);
            const fileId = parseId(args.file_id);
            if (folderId == null || fileId == null) {
              return toolError("folder_id and file_id are required");
            }
            const world = await resolveWorld({ args, entityId: folderId, access: "write" });
            if (typeof world === "string") return world;
            try {
              const item = await addFileToObjectFolder(folderId, fileId);
              if (item.world_id !== world) return toolError("cross-world access denied");
              return toolResult({ ok: true, action: "folder_add_file", item });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_folder_remove_file",
          description: "Remove object_file id from object_folder.file_ids",
          parameters: {
            type: "object",
            properties: {
              folder_id: { type: "integer" },
              file_id: { type: "integer" },
            },
            required: ["folder_id", "file_id"],
          },
          handler: async (args) => {
            const folderId = parseId(args.folder_id);
            const fileId = parseId(args.file_id);
            if (folderId == null || fileId == null) {
              return toolError("folder_id and file_id are required");
            }
            const world = await resolveWorld({ args, entityId: folderId, access: "write" });
            if (typeof world === "string") return world;
            try {
              const item = await removeFileFromObjectFolder(folderId, fileId);
              if (item.world_id !== world) return toolError("cross-world access denied");
              return toolResult({ ok: true, action: "folder_remove_file", item });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
        {
          name: "object_storage_folder_delete",
          description: "Soft-delete an object_folder (does not delete member files)",
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: async (args) => {
            const id = parseId(args.id);
            if (id == null) return toolError("id is required");
            const world = await resolveWorld({ args, entityId: id, access: "write" });
            if (typeof world === "string") return world;
            try {
              await deleteObjectFolder(id);
              return toolResult({ ok: true, action: "folder_delete", id });
            } catch (e) {
              return toolError(String(e));
            }
          },
        },
      ],
      OBJECT_STORAGE_TOOL_RETURNS,
    ),
  );
}
