import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import type { ProjectStatus } from "@freeanima/host/core/db/schema/entity";

import {
  createProject,
  createProjectFolder,
  deleteProject,
  getProject,
  listProjectFolders,
  listProjects,
  updateProject,
} from "./index.ts";
import { PROJECT_TOOL_RETURNS } from "./return-schemas.ts";

const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

function parseSubjectKind(raw: unknown): SubjectKind | undefined {
  if (raw === "user" || raw === "agent") return raw;
  return undefined;
}

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

async function resolveProjectToolWorld(opts: {
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
    return resolveSubjectWorldId(subjectKind);
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

const WORLD_ID_OPTIONAL = {
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description: "Optional world override; otherwise subject_kind selects the private world",
  },
  subject_kind: {
    type: "string",
    enum: ["user", "agent"],
    description:
      "Owning subject: user or agent (required unless world_id or entity id resolves world)",
  },
} as const;

function projectPayload(row: Awaited<ReturnType<typeof getProject>> & object) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    start_at: row.start_at,
    end_at: row.end_at,
    folder_id: row.folder_id,
  };
}

async function resolveWorld(
  args: Record<string, unknown>,
  access: "read" | "write" = "read",
): Promise<number | string> {
  return resolveProjectToolWorld({ args, access });
}

export function registerProjectTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "project",
    "Project management: folders and projects. Load toolset `task` for task items.",
    attachToolReturns(
      [
        {
          name: "project_list",
          description: "List projects (optional folder_id or status filter)",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              folder_id: { type: "integer" },
              status: { type: "string", enum: ["active", "completed", "cancelled", "on_hold"] },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld(args);
            if (typeof worldId === "string") return worldId;
            const projects = await listProjects(
              worldId,
              omitUndefined({
                folder_id: args.folder_id != null ? Number(args.folder_id) : undefined,
                status: args.status != null ? (String(args.status) as ProjectStatus) : undefined,
              }),
            );
            return toolResult({
              ok: true,
              action: "list",
              count: projects.length,
              projects: projects.map(projectPayload),
            });
          },
        },
        {
          name: "project_get",
          description: "Get project by id",
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL, id: { type: "integer" } },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            const worldId = await resolveProjectToolWorld({ args, entityId: id });
            if (typeof worldId === "string") return worldId;
            const item = await getProject(worldId, id);
            if (!item) return toolError(`project not found: ${id}`);
            return toolResult({ ok: true, action: "get", item: projectPayload(item) });
          },
        },
        {
          name: "project_create",
          description: "Create a project; start_at/end_at optional (omit or null if unset)",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              title: { type: "string" },
              start_at: {
                type: "string",
                description: "ISO start date; omit or null if unset",
              },
              end_at: {
                type: "string",
                description: "ISO end date; omit or null if unset",
              },
              content: { type: "string", description: "Project background / notes" },
              folder_id: { type: "integer" },
              product_tag: { type: "string" },
            },
            required: ["subject_kind", "title"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld(args, "write");
            if (typeof worldId === "string") return worldId;
            const title = String(args.title ?? "").trim();
            if (!title) return toolError("title is required");
            try {
              const item = await createProject(
                worldId,
                omitUndefined({
                  title,
                  start_at:
                    args.start_at == null || args.start_at === "" ? null : String(args.start_at),
                  end_at: args.end_at == null || args.end_at === "" ? null : String(args.end_at),
                  content: args.content != null ? String(args.content) : undefined,
                  folder_id:
                    args.folder_id != null && args.folder_id !== ""
                      ? Number(args.folder_id)
                      : undefined,
                  product_tag: args.product_tag != null ? String(args.product_tag) : undefined,
                }),
              );
              return toolResult({ ok: true, action: "create", item: projectPayload(item) });
            } catch (e) {
              return toolError(String(e instanceof Error ? e.message : e));
            }
          },
        },
        {
          name: "project_patch",
          description: "Update project fields, content, or terminal status",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              title: { type: "string" },
              content: { type: "string", description: "Project background / notes" },
              status: { type: "string", enum: ["active", "completed", "cancelled", "on_hold"] },
              linked_diary_ids: { type: "array", items: { type: "integer" } },
            },
            required: ["id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            const worldId = await resolveProjectToolWorld({
              args,
              entityId: id,
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            try {
              const item = await updateProject(
                worldId,
                omitUndefined({
                  id,
                  title: args.title != null ? String(args.title) : undefined,
                  content: args.content != null ? String(args.content) : undefined,
                  status: args.status != null ? String(args.status) : undefined,
                  linked_diary_ids: Array.isArray(args.linked_diary_ids)
                    ? args.linked_diary_ids.map((v) => Number(v)).filter((n) => n > 0)
                    : undefined,
                }) as Parameters<typeof updateProject>[1],
              );
              if (!item) return toolError(`project not found: ${id}`);
              return toolResult({ ok: true, action: "patch", item: projectPayload(item) });
            } catch (e) {
              return toolError(String(e instanceof Error ? e.message : e));
            }
          },
        },
        {
          name: "project_delete",
          description: "Delete project; tasks return to Backlog",
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL, id: { type: "integer" } },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            const worldId = await resolveProjectToolWorld({
              args,
              entityId: id,
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            const ok = await deleteProject(worldId, id);
            if (!ok) return toolError(`project not found: ${id}`);
            return toolResult({ ok: true, action: "delete" });
          },
        },
        {
          name: "projectfolder_list",
          description: "List project folders",
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld(args);
            if (typeof worldId === "string") return worldId;
            const folders = await listProjectFolders(worldId);
            return toolResult({
              ok: true,
              action: "list",
              count: folders.length,
              folders: folders.map((f) => ({
                id: f.id,
                name: f.name,
                parent_id: f.parent_id,
              })),
            });
          },
        },
        {
          name: "projectfolder_create",
          description: "Create a project folder",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              name: { type: "string" },
              parent_id: { type: "integer" },
            },
            required: ["subject_kind", "name"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld(args, "write");
            if (typeof worldId === "string") return worldId;
            const name = String(args.name ?? "").trim();
            if (!name) return toolError("name is required");
            const item = await createProjectFolder(
              worldId,
              omitUndefined({
                name,
                parent_id:
                  args.parent_id != null && args.parent_id !== ""
                    ? Number(args.parent_id)
                    : undefined,
              }),
            );
            return toolResult({
              ok: true,
              action: "create",
              item: { id: item.id, name: item.name, parent_id: item.parent_id },
            });
          },
        },
      ],
      PROJECT_TOOL_RETURNS,
    ),
  );
}
