import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { upsertSkillEntity } from "@freeanima/host/core/db/pg/skill";
import { parseFrontmatter, stripFrontmatter, normalizeToolList } from "./content.ts";
import type { SkillRegistry } from "./registry.ts";
import { hydrateSkillRegistry } from "./store.ts";
import { SKILL_CURATION_NAME } from "./review-constants.ts";
import researchMd from "./builtins/research.md" with { type: "text" };
import skillCurationMd from "./builtins/skill-curation.md" with { type: "text" };

/** Bun `type: "text"` 嵌入，standalone compile 后仍可读（勿用 dirname+readFileSync） */
const BUILTIN_SOURCES: ReadonlyArray<{ file: string; raw: string }> = [
  { file: "research.md", raw: researchMd },
  { file: `${SKILL_CURATION_NAME}.md`, raw: skillCurationMd },
];

/** 幂等种子 builtin skills 到 commons world，并 hydrate registry */
export async function seedBuiltinSkills(skills: SkillRegistry): Promise<number> {
  const commonsId = getResolvedWorldContext().commons_world_id;
  let seeded = 0;
  for (const { file, raw } of BUILTIN_SOURCES) {
    const fm = parseFrontmatter(raw);
    const name = (fm.name ?? file.replace(/\.md$/, "")).trim();
    const description = (fm.description ?? "").trim();
    const content = stripFrontmatter(raw);
    await upsertSkillEntity({
      world_id: commonsId,
      name,
      description,
      content,
      origin: "builtin",
      status: "active",
      body: {
        origin: "builtin",
        status: "active",
        license: fm.license,
        compatibility: fm.compatibility,
        metadata: fm.metadata ?? {},
        allowed_tools: normalizeToolList(fm["allowed-tools"] ?? fm.allowed_tools),
        denied_tools: normalizeToolList(fm.denied_tools),
      },
    });
    seeded += 1;
  }
  await hydrateSkillRegistry(skills);
  return seeded;
}
