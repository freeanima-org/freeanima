import type { SkillRegistry } from "@freeanima/engine-skill";
import {
  createUserSkill,
  deleteUserSkill,
  listSkillsForTool,
  loadSkillIntoContext,
  registerUserSkillsFromHome,
  searchSkillsForTool,
  viewUserSkill,
} from "@freeanima/engine-skill";
import type { ToolRegistry } from "@freeanima/engine-tool";

let userSkillsRegistered = false;

/** 扫描 ~/.anima/skills 并注册用户技能（幂等） */
export function registerUserSkills(skills: SkillRegistry): number {
  if (userSkillsRegistered) return 0;
  userSkillsRegistered = true;
  return registerUserSkillsFromHome(skills);
}

export function registerSkillsTools(tools: ToolRegistry, skills: SkillRegistry): void {
  registerUserSkills(skills);

  tools.register({
    name: "create_skill",
    description: "创建新技能（Markdown 文件，含 YAML frontmatter），写入 ~/.anima/skills 并注册",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "技能名称（文件名）" },
        description: { type: "string", description: "简短描述" },
        content: { type: "string", description: "技能正文（Markdown）" },
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
  });

  tools.register({
    name: "load_skill",
    description:
      "加载技能正文到当前对话上下文（通过 tool 消息返回，不写入 system prompt）。使用前可用 list_skills / search_skills 发现技能。",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "已注册的技能名称" } },
      required: ["name"],
    },
    handler: (args) => loadSkillIntoContext(skills, String(args.name ?? "")),
  });

  tools.register({
    name: "list_skills",
    description: "列出技能注册中心中所有已注册技能（名称、描述、来源、目录）",
    parameters: { type: "object", properties: {} },
    handler: () => listSkillsForTool(skills),
  });

  tools.register({
    name: "search_skills",
    description: "在技能注册中心按名称、描述或来源搜索技能",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
    handler: (args) => searchSkillsForTool(skills, String(args.query ?? "")),
  });

  tools.register({
    name: "view_skill",
    description: "查看技能完整 Markdown 文件（含 frontmatter）",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => viewUserSkill(skills, String(args.name ?? "")),
  });

  tools.register({
    name: "delete_skill",
    description: "删除用户自建技能（~/.anima/skills）；内置技能不可删",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => deleteUserSkill(skills, String(args.name ?? "")),
  });
}
