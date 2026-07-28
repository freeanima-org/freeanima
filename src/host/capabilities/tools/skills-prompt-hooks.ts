import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import { systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import type { SkillRegistry } from "@freeanima/host/core/skill";

/** Progressive disclosure：系统提示仅注入 name + description 目录 */
export function registerSkillsCatalogSystemPromptHook(
  registry: HookRegistry,
  getSkills: () => SkillRegistry,
): void {
  registry.on(systemPromptBuild, () => {
    const active = getSkills().listActive();
    if (active.length === 0) return { status: "ok" };
    const lines = active.map((s) => `- **${s.name}**: ${s.description || "(no description)"}`);
    const content = [
      "## Skills",
      "Available techniques (load full instructions with `skill_load` when needed):",
      ...lines,
    ].join("\n");
    return {
      status: "ok",
      data: {
        sections: [{ id: "skills-catalog", content, order: 9 }],
      },
    };
  });
}
