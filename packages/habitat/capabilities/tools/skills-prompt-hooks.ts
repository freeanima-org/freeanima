import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import {
  entityMatchesScenarioCatalog,
  PROMPT_XML_TAGS,
  resolveCodingCatalogTagId,
  systemPromptBuild,
} from "@freeanima/habitat/core/hooks/prompt";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";

/** Progressive disclosure：系统提示仅注入 name + description 目录 */
export function registerSkillsCatalogSystemPromptHook(
  registry: HookRegistry,
  getSkills: () => SkillRegistry,
): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      const scenario = ctx.meta?.scenario;
      const active = getSkills().listActive();
      if (active.length === 0) return { status: "ok" };

      const tagIdCache = new Map<number, number | null>();
      const filtered = [];
      for (const skill of active) {
        let codingTagId = tagIdCache.get(skill.worldId);
        if (codingTagId === undefined) {
          codingTagId = await resolveCodingCatalogTagId(skill.worldId);
          tagIdCache.set(skill.worldId, codingTagId);
        }
        if (entityMatchesScenarioCatalog(skill.tag_ids, codingTagId, scenario)) {
          filtered.push(skill);
        }
      }
      if (filtered.length === 0) return { status: "ok" };

      const lines = filtered.map((s) => `- **${s.name}**: ${s.description || "(no description)"}`);
      const content = [
        "Available techniques (load full instructions with `skill_load` when needed):",
        ...lines,
      ].join("\n");
      return {
        status: "ok",
        data: {
          sections: [
            {
              id: "skills-catalog",
              content,
              order: 9,
              priority: 5,
              budgetChars: 2_500,
              xmlTag: PROMPT_XML_TAGS.skills,
            },
          ],
        },
      };
    },
    { llm_kind: "conversation" },
  );
}
