import type { SkillRegistry } from "@freeanima/host/core/skill";
import {
  createUserSkill,
  deleteUserSkill,
  exportUserSkill,
  importUserSkill,
  listSkillsForTool,
  loadSkillIntoContext,
  searchSkillsForTool,
  viewUserSkill,
} from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns } from "@freeanima/host/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

export function registerSkillsTools(toolSets: ToolSetRegistry, skills: SkillRegistry): void {
  toolSets.registerToolSet(
    "skill",
    "Skill registry and management",
    attachToolReturns(
      [
        {
          name: "skill_create",
          description:
            "Create a new skill entity (Markdown body) in the acting agent private world and register it",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Skill name (agentskills: lowercase, digits, hyphens)",
              },
              description: { type: "string", description: "Short description" },
              content: { type: "string", description: "Skill body (Markdown)" },
            },
            required: ["name", "description", "content"],
          },
          handler: async (args) =>
            createUserSkill(
              skills,
              String(args.name ?? ""),
              String(args.description ?? ""),
              String(args.content ?? ""),
            ),
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
          handler: async (args) => loadSkillIntoContext(skills, String(args.name ?? "")),
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
          handler: (args) => searchSkillsForTool(skills, String(args.query ?? "")),
        },
        {
          name: "skill_view",
          description: "View full skill Markdown (YAML frontmatter + body) for export",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => viewUserSkill(skills, String(args.name ?? "")),
        },
        {
          name: "skill_delete",
          description: "Delete a non-builtin skill entity",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => deleteUserSkill(skills, String(args.name ?? "")),
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
          handler: async (args) => importUserSkill(skills, String(args.markdown ?? "")),
        },
        {
          name: "skill_export",
          description: "Export a skill as agentskills-compatible Markdown",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: async (args) => exportUserSkill(skills, String(args.name ?? "")),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
