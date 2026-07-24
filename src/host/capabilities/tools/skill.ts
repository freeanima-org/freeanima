import type { SkillRegistry } from "@freeanima/host/core/skill";
import {
  createUserSkill,
  deleteUserSkill,
  listSkillsForTool,
  loadSkillIntoContext,
  registerUserSkillsFromHome,
  searchSkillsForTool,
  viewUserSkill,
} from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns } from "@freeanima/host/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

let userSkillsRegistered = false;

/** Scan ~/.anima/skills and register user skills (idempotent) */
export function registerUserSkills(skills: SkillRegistry): number {
  if (userSkillsRegistered) return 0;
  userSkillsRegistered = true;
  return registerUserSkillsFromHome(skills);
}

export function registerSkillsTools(toolSets: ToolSetRegistry, skills: SkillRegistry): void {
  registerUserSkills(skills);

  toolSets.registerToolSet(
    "skill",
    "Skill registry and management",
    attachToolReturns(
      [
        {
          name: "skill_create",
          description:
            "Create a new skill (Markdown with YAML frontmatter), write to ~/.anima/skills and register",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Skill name (filename)" },
              description: { type: "string", description: "Short description" },
              content: { type: "string", description: "Skill body (Markdown)" },
            },
            required: ["name", "description", "content"],
          },
          handler: (args) =>
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
          handler: (args) => loadSkillIntoContext(skills, String(args.name ?? "")),
        },
        {
          name: "skill_list",
          description:
            "List all registered skills in the registry (name, description, source, directory)",
          parameters: { type: "object", properties: {} },
          handler: () => listSkillsForTool(skills),
        },
        {
          name: "skill_search",
          description: "Search skills in the registry by name, description, or source",
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
          description: "View full skill Markdown file (with frontmatter)",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: (args) => viewUserSkill(skills, String(args.name ?? "")),
        },
        {
          name: "skill_delete",
          description:
            "Delete user-created skill (~/.anima/skills); built-in skills cannot be deleted",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          handler: (args) => deleteUserSkill(skills, String(args.name ?? "")),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
