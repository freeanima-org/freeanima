import type { Context } from "cordis";
import { onSystemPromptBuild } from "@freeanima/core/hooks/cordis";
import {
  entityMatchesScenarioCatalog,
  PROMPT_XML_TAGS,
  resolveCodingCatalogTagId,
} from "@freeanima/core/hooks/prompt";
import type { SkillRegistry } from "@freeanima/core/skill";

/** Progressive disclosure：系统提示仅注入 name + description 目录 */
export function registerSkillsCatalogSystemPromptHook(
  ctx: Context,
  getSkills: () => SkillRegistry,
): void {
  onSystemPromptBuild(ctx, async (event) => {
    const scenario = event.meta?.scenario;
    const active = getSkills().listActive();
    if (active.length === 0) return undefined;

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
    if (filtered.length === 0) return undefined;

    const lines = filtered.map((s) => `- **${s.name}**: ${s.description || "(no description)"}`);
    const content = [
      "Available techniques (load full instructions with `skill_load` when needed):",
      ...lines,
    ].join("\n");
    return {
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
    };
  });
}
