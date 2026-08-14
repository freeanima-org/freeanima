import type { SkillRegistry } from "@freeanima/habitat/core/skill";
import {
  createUserSkill,
  deleteUserSkill,
  exportUserSkill,
  importUserSkill,
  listSkillsForTool,
  loadSkillIntoContext,
  parseCreateSkillArgs,
  patchUserSkill,
  searchSkillsForTool,
  updateUserSkill,
  viewUserSkill,
} from "@freeanima/habitat/core/skill";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns } from "@freeanima/habitat/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export function registerSkillsTools(toolSets: ToolSetRegistry, skills: SkillRegistry): void {
  toolSets.registerToolSet(
    "skill",
    "Skill registry and management",
    attachToolReturns(
      [
        {
          name: "skill_create",
          description:
            "Create a skill (Markdown body) in the agent private world. Use origin=evolved for self-evolved procedures (default origin=user). Fill allowed_tools when the skill needs specific tools.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Skill name (agentskills: lowercase, digits, hyphens)",
              },
              description: { type: "string", description: "Short description (when to use)" },
              content: { type: "string", description: "Skill body (Markdown)" },
              origin: {
                type: "string",
                description: "user (default) | evolved (self-evolution / review bypass)",
                enum: ["user", "evolved"],
              },
              allowed_tools: {
                type: "array",
                items: { type: "string" },
                description: "Tool names or @ToolSet ids this skill may use",
              },
              denied_tools: {
                type: "array",
                items: { type: "string" },
                description: "Optional tool deny list",
              },
            },
            required: ["name", "description", "content"],
          },
          handler: async (args) => {
            const parsed = parseCreateSkillArgs(args);
            return createUserSkill(
              skills,
              parsed.name,
              parsed.description,
              parsed.content,
              omitUndefined({
                origin: parsed.origin,
                allowed_tools: parsed.allowed_tools,
                denied_tools: parsed.denied_tools,
              }),
            );
          },
        },
        {
          name: "skill_patch",
          description:
            "Targeted find-and-replace inside an existing non-builtin skill body (preferred over full rewrite).",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Skill name" },
              old_string: {
                type: "string",
                description: "Exact text to find (must be unique unless replace_all)",
              },
              new_string: {
                type: "string",
                description: "Replacement text (may be empty to delete)",
              },
              replace_all: {
                type: "boolean",
                description: "Replace all occurrences (default false; requires unique match)",
              },
            },
            required: ["name", "old_string", "new_string"],
          },
          handler: async (args) =>
            patchUserSkill(
              skills,
              coerceString(args.name ?? ""),
              coerceString(args.old_string ?? ""),
              coerceString(args.new_string ?? ""),
              args.replace_all === true,
            ),
        },
        {
          name: "skill_update",
          description:
            "Replace description, content, and/or allowed_tools/denied_tools on a non-builtin skill (major edit).",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Skill name" },
              description: { type: "string", description: "New short description" },
              content: { type: "string", description: "New Markdown body" },
              allowed_tools: {
                type: "array",
                items: { type: "string" },
                description: "Replace allowed_tools list",
              },
              denied_tools: {
                type: "array",
                items: { type: "string" },
                description: "Replace denied_tools list",
              },
            },
            required: ["name"],
          },
          handler: async (args) => {
            const allowed =
              args.allowed_tools === undefined
                ? undefined
                : Array.isArray(args.allowed_tools)
                  ? args.allowed_tools.map((x) => String(x))
                  : undefined;
            const denied =
              args.denied_tools === undefined
                ? undefined
                : Array.isArray(args.denied_tools)
                  ? args.denied_tools.map((x) => String(x))
                  : undefined;
            return updateUserSkill(
              skills,
              coerceString(args.name ?? ""),
              omitUndefined({
                description:
                  args.description !== undefined ? coerceString(args.description) : undefined,
                content: args.content !== undefined ? coerceString(args.content) : undefined,
                allowed_tools: allowed,
                denied_tools: denied,
              }),
            );
          },
        },
        {
          name: "skill_load",
          description:
            "Load skill body into current conversation context (via tool message, not written to system prompt). Use skill_list / skill_search to discover skills first.",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Registered skill name" } },
            required: ["name"],
          },
          handler: async (args) => loadSkillIntoContext(skills, coerceString(args.name ?? "")),
        },
        {
          name: "skill_list",
          description: "List active skills (name, description, origin, allowed_tools)",
          parameters: { type: "object", properties: {} },
          handler: () => listSkillsForTool(skills),
        },
        {
          name: "skill_search",
          description: "Search skills by name, description, or origin",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keyword" },
            },
            required: ["query"],
          },
          handler: (args) => searchSkillsForTool(skills, coerceString(args.query ?? "")),
        },
        {
          name: "skill_view",
          description: "View full skill Markdown (YAML frontmatter + body) for export",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => viewUserSkill(skills, coerceString(args.name ?? "")),
        },
        {
          name: "skill_delete",
          description: "Delete a non-builtin skill entity",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => deleteUserSkill(skills, coerceString(args.name ?? "")),
        },
        {
          name: "skill_import",
          description:
            "Import a SKILL.md (agentskills-compatible Markdown+YAML) into the private world",
          parameters: {
            type: "object",
            properties: {
              markdown: { type: "string", description: "Full SKILL.md text including frontmatter" },
            },
            required: ["markdown"],
          },
          handler: async (args) => importUserSkill(skills, coerceString(args.markdown ?? "")),
        },
        {
          name: "skill_export",
          description: "Export a skill as agentskills-compatible Markdown",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => exportUserSkill(skills, coerceString(args.name ?? "")),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
