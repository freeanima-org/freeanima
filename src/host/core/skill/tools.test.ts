import { describe, expect, it } from "bun:test";
import { skillBodySchema } from "@freeanima/host/core/db/schema/entity";
import { SkillRegistry, skillDefFromBody } from "./registry.ts";
import {
  formatSkillsPrefix,
  listSkillsForTool,
  loadSkillIntoContext,
  prependSkillsToPrompt,
  searchSkillsForTool,
} from "./tools.ts";

function registerFmt(skills: SkillRegistry, body = "skill body"): void {
  skills.register(
    skillDefFromBody(
      {
        name: "fmt-skill",
        description: "fmt",
        entityId: 1,
        worldId: 10,
        content: body,
        source: "test",
      },
      skillBodySchema.parse({ origin: "user", status: "active" }),
    ),
  );
}

describe("skill tools", () => {
  it("loadSkillIntoContext validates name and content", async () => {
    const skills = new SkillRegistry();
    expect(await loadSkillIntoContext(skills, "  ")).toContain("cannot be empty");
    expect(await loadSkillIntoContext(skills, "missing")).toContain("not registered");
  });

  it("listSkillsForTool returns empty message", () => {
    const empty = new SkillRegistry();
    const out = JSON.parse(listSkillsForTool(empty));
    expect(out.total).toBe(0);
    expect(out.message).toContain("No registered");
  });

  it("searchSkillsForTool wraps registry search", () => {
    const skills = new SkillRegistry();
    registerFmt(skills);
    const out = JSON.parse(searchSkillsForTool(skills, "fmt"));
    expect(out.total).toBe(1);
    expect(out.skills[0]?.name).toBe("fmt-skill");
  });

  it("formatSkillsPrefix and prependSkillsToPrompt wrap skill bodies", () => {
    const skills = new SkillRegistry();
    registerFmt(skills, "skill body");
    expect(formatSkillsPrefix(skills, ["fmt-skill"])).toContain('<skill name="fmt-skill">');
    expect(prependSkillsToPrompt(skills, "prompt", ["fmt-skill"])).toMatch(
      /<skill name="fmt-skill">[\s\S]+prompt$/,
    );
    expect(prependSkillsToPrompt(skills, "prompt", ["missing"])).toBe("prompt");
  });
});
