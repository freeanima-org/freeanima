import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { upsertSkillEntity } from "@freeanima/host/core/db/pg/skill";
import { parseFrontmatter, stripFrontmatter, normalizeToolList } from "./content.ts";
import type { SkillRegistry } from "./registry.ts";
import { hydrateSkillRegistry } from "./store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const BUILTIN_FILES = ["research.md"] as const;

/** 幂等种子 builtin skills 到 commons world，并 hydrate registry */
export async function seedBuiltinSkills(skills: SkillRegistry): Promise<number> {
  const commonsId = getResolvedWorldContext().commons_world_id;
  let seeded = 0;
  for (const file of BUILTIN_FILES) {
    const raw = readFileSync(join(HERE, "builtins", file), "utf-8");
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
