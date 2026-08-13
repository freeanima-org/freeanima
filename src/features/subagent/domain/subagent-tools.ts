import type { SubjectKind } from "@freeanima/host/core/config";
import {
  attachToolReturns,
  getToolConversationId,
  toolError,
  toolResult,
  type ToolSetRegistry,
} from "@freeanima/host/core/tool";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";
import { getRuntimeDeps } from "@freeanima/host/platform/service/runtime-context.ts";
import { runSubagentTasks } from "@freeanima/host/platform/service/use-cases/subagent-runner.ts";

import {
  createSubagent,
  deleteSubagent,
  getSubagent,
  getSubagentBySlug,
  listSubagents,
  updateSubagent,
} from "./subagent-store.ts";
import type { SubagentTaskInput } from "./types.ts";
import { SUBAGENT_TOOL_RETURNS } from "./return-schemas.ts";
import { normalizePromptIncludes } from "./subagent-prompt.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer",
    description: "Optional world override; otherwise subject_kind selects the private world",
  },
  subject_kind: {
    type: "string",
    enum: ["user", "agent"],
    description:
      "Owning subject: user or agent (required unless world_id or entity id resolves world)",
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

function parseStringArray(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function parseTask(raw: Record<string, unknown>): SubagentTaskInput | string {
  const goal = coerceString(raw.goal ?? "").trim();
  if (!goal) return "goal is required";
  const id = raw.id != null ? Number(raw.id) : undefined;
  const slug = raw.slug != null ? coerceString(raw.slug).trim() : undefined;
  const hasNamed = (id != null && Number.isFinite(id) && id > 0) || Boolean(slug);
  const instructions = raw.instructions != null ? coerceString(raw.instructions).trim() : undefined;
  const allowedRaw = parseStringArray(raw.allowed_tools);
  const promptIncludes = normalizePromptIncludes(parseStringArray(raw.prompt_includes));

  if (!hasNamed) {
    if (!instructions) {
      return "ephemeral run requires instructions (or pass slug|id for a named profile)";
    }
    if (raw.allowed_tools == null) {
      return "ephemeral run requires allowed_tools (array; empty = no tools)";
    }
  }

  return omitUndefined({
    goal,
    id: id != null && Number.isFinite(id) && id > 0 ? Math.floor(id) : undefined,
    slug,
    title: raw.title != null ? coerceString(raw.title).trim() || undefined : undefined,
    instructions: instructions || undefined,
    allowed_tools: hasNamed ? undefined : (allowedRaw ?? []),
    context: raw.context != null ? coerceString(raw.context) : undefined,
    skills: parseStringArray(raw.skills),
    max_turns:
      raw.max_turns != null && Number(raw.max_turns) > 0
        ? Math.floor(Number(raw.max_turns))
        : undefined,
    denied_tools: parseStringArray(raw.denied_tools),
    prompt_includes: promptIncludes.length > 0 ? promptIncludes : undefined,
  });
}

function rowPayload(row: Awaited<ReturnType<typeof getSubagent>>) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    skills: row.skills,
    max_turns: row.max_turns,
    allowed_tools: row.allowed_tools,
    denied_tools: row.denied_tools,
    prompt_includes: row.prompt_includes,
    world_id: row.world_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function registerSubagentTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "subagent",
    "Named subagent profiles and dispatch (named slug|id, or ephemeral instructions+allowed_tools); returns synchronously while projecting live child steps to the parent Chat strip",
    attachToolReturns(
      [
        {
          name: "subagent_list",
          description: "List subagent profiles in the world",
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;
            const items = await listSubagents(worldId);
            return toolResult({
              ok: true,
              action: "list",
              count: items.length,
              items: items.map((r) => rowPayload(r)),
            });
          },
        },
        {
          name: "subagent_get",
          description: "Get a subagent by id or slug",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              slug: { type: "string" },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;
            const id = args.id != null ? Number(args.id) : undefined;
            let row = null;
            if (id != null && Number.isFinite(id) && id > 0) {
              row = await getSubagent(Math.floor(id));
              if (row && row.world_id !== worldId) row = null;
            } else if (typeof args.slug === "string") {
              row = await getSubagentBySlug(worldId, args.slug);
            } else {
              return toolError("id or slug is required");
            }
            if (!row) return toolError("subagent not found");
            return toolResult({ ok: true, action: "get", item: rowPayload(row) });
          },
        },
        {
          name: "subagent_create",
          description:
            "Create a named subagent profile. allowed_tools is the hard ceiling (empty = no tools).",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              slug: { type: "string", description: "Stable lowercase slug" },
              title: { type: "string" },
              summary: { type: "string" },
              content: { type: "string", description: "Extra system instructions" },
              skills: { type: "array", items: { type: "string" } },
              max_turns: { type: "integer" },
              allowed_tools: {
                type: "array",
                items: { type: "string" },
                description: "Tool names or @ToolSet; empty means no tools",
              },
              denied_tools: { type: "array", items: { type: "string" } },
              prompt_includes: {
                type: "array",
                items: { type: "string", enum: ["self", "world", "time"] },
                description: "Opt-in child prompt sections (default none)",
              },
            },
            required: ["subject_kind", "slug", "title"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args, access: "write" });
            if (typeof worldId === "string") return worldId;
            try {
              const item = await createSubagent(worldId, {
                slug: coerceString(args.slug ?? ""),
                title: coerceString(args.title ?? ""),
                ...omitUndefined({
                  summary: args.summary != null ? coerceString(args.summary) : undefined,
                  content: args.content != null ? coerceString(args.content) : undefined,
                  skills: parseStringArray(args.skills),
                  max_turns:
                    args.max_turns != null && Number(args.max_turns) > 0
                      ? Math.floor(Number(args.max_turns))
                      : undefined,
                  allowed_tools: parseStringArray(args.allowed_tools),
                  denied_tools: parseStringArray(args.denied_tools),
                  prompt_includes: normalizePromptIncludes(parseStringArray(args.prompt_includes)),
                }),
              });
              return toolResult({ ok: true, action: "create", item: rowPayload(item) });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
        {
          name: "subagent_update",
          description: "Update a subagent profile fields",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              content: { type: "string" },
              skills: { type: "array", items: { type: "string" } },
              max_turns: { type: "integer" },
              allowed_tools: { type: "array", items: { type: "string" } },
              denied_tools: { type: "array", items: { type: "string" } },
              prompt_includes: {
                type: "array",
                items: { type: "string", enum: ["self", "world", "time"] },
              },
            },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
            const worldId = await resolveWorld({
              args,
              entityId: Math.floor(id),
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            try {
              const item = await updateSubagent(worldId, {
                id: Math.floor(id),
                ...omitUndefined({
                  slug: args.slug != null ? coerceString(args.slug) : undefined,
                  title: args.title != null ? coerceString(args.title) : undefined,
                  summary: args.summary != null ? coerceString(args.summary) : undefined,
                  content: args.content != null ? coerceString(args.content) : undefined,
                  skills: parseStringArray(args.skills),
                  max_turns:
                    args.max_turns != null
                      ? Number(args.max_turns) > 0
                        ? Math.floor(Number(args.max_turns))
                        : null
                      : undefined,
                  allowed_tools: parseStringArray(args.allowed_tools),
                  denied_tools: parseStringArray(args.denied_tools),
                  prompt_includes:
                    args.prompt_includes != null
                      ? normalizePromptIncludes(parseStringArray(args.prompt_includes))
                      : undefined,
                }),
              });
              return toolResult({ ok: true, action: "update", item: rowPayload(item) });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
        {
          name: "subagent_delete",
          description: "Soft-delete a subagent profile",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
            },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
            const worldId = await resolveWorld({
              args,
              entityId: Math.floor(id),
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            try {
              await deleteSubagent(worldId, Math.floor(id));
              return toolResult({ ok: true, action: "delete", id: Math.floor(id) });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
        {
          name: "subagent_run",
          description:
            "Run subagent(s); returns when finished. Named: pass slug|id (tools from profile). Ephemeral: omit slug/id, pass instructions + allowed_tools (hard ceiling; empty array = no tools). Always set title for audit UI. Optional prompt_includes: self|world|time (opt-in; default none). No toolset_load. While running, child tool steps stream to the parent Chat tool strip.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              goal: { type: "string", description: "Single-task sugar when tasks omitted" },
              title: {
                type: "string",
                description:
                  "Short human-readable AutoLlm run name for Habitat (prefer filling every call)",
              },
              slug: { type: "string", description: "Named profile slug" },
              id: { type: "integer", description: "Named profile entity id" },
              instructions: {
                type: "string",
                description: "Ephemeral role/system instructions (required when slug/id omitted)",
              },
              allowed_tools: {
                type: "array",
                items: { type: "string" },
                description:
                  "Ephemeral tool ceiling (@ToolSet or names). Required when slug/id omitted; ignored for named (cannot enlarge profile allow)",
              },
              context: { type: "string" },
              skills: { type: "array", items: { type: "string" } },
              max_turns: { type: "integer" },
              denied_tools: {
                type: "array",
                items: { type: "string" },
                description: "Extra deny (narrow only)",
              },
              prompt_includes: {
                type: "array",
                items: { type: "string", enum: ["self", "world", "time"] },
                description: "Opt-in side sections for child system prompt (union with profile)",
              },
              tasks: {
                type: "array",
                items: { type: "object" },
                description:
                  "Parallel tasks; each is named (slug|id) or ephemeral (instructions+allowed_tools)",
              },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;

            let tasks: SubagentTaskInput[] = [];
            if (Array.isArray(args.tasks) && args.tasks.length > 0) {
              for (const raw of args.tasks) {
                if (raw == null || typeof raw !== "object") {
                  return toolError("each task must be an object");
                }
                const parsed = parseTask(raw as Record<string, unknown>);
                if (typeof parsed === "string") return toolError(parsed);
                tasks.push(parsed);
              }
            } else {
              const parsed = parseTask(args);
              if (typeof parsed === "string") return toolError(parsed);
              tasks = [parsed];
            }

            try {
              const deps = getRuntimeDeps();
              const { results } = await runSubagentTasks(deps, {
                worldId,
                tasks,
                ...omitUndefined({
                  parentConversationId: getToolConversationId() ?? undefined,
                }),
              });
              return toolResult({
                ok: true,
                action: "run",
                count: results.length,
                results,
              });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
      SUBAGENT_TOOL_RETURNS,
    ),
  );
}
