import {
  createSkill,
  deleteSkill,
  loadSkill,
  listSkills,
  unloadSkill,
  viewSkill,
} from "@freeanima/legacy-engine";
import { registerTool } from "@freeanima/legacy-kernel";

export function registerSkillsTools(): void {
  registerTool({
    name: "create_skill",
    description: "创建新技能（Markdown 文件，含 YAML frontmatter）",
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
      createSkill(
        String(args.name ?? ""),
        String(args.description ?? ""),
        String(args.content ?? ""),
      ),
  });

  registerTool({
    name: "load_skill",
    description: "加载技能到活跃列表并注入 system prompt",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => loadSkill(String(args.name ?? "")),
  });

  registerTool({
    name: "unload_skill",
    description: "从活跃列表卸载技能",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => unloadSkill(String(args.name ?? "")),
  });

  registerTool({
    name: "list_skills",
    description: "列出所有技能及加载状态",
    parameters: { type: "object", properties: {} },
    handler: () => listSkills(),
  });

  registerTool({
    name: "view_skill",
    description: "查看技能完整内容",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => viewSkill(String(args.name ?? "")),
  });

  registerTool({
    name: "delete_skill",
    description: "删除技能文件",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "技能名称" } },
      required: ["name"],
    },
    handler: (args) => deleteSkill(String(args.name ?? "")),
  });
}
