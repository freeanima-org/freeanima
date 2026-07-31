import { describe, expect, it } from "bun:test";
import { SkillRegistry, skillDefFromBody } from "./registry.ts";
import { skillBodySchema } from "@freeanima/host/core/db/schema/entity";

describe("SkillRegistry", () => {
  it("register / list / search / private overlay by name", () => {
    const skills = new SkillRegistry();
    const body = skillBodySchema.parse({
      origin: "builtin",
      status: "active",
      allowed_tools: ["memory_semantic_search"],
    });
    skills.register(
      skillDefFromBody(
        {
          name: "research",
          description: "Commons research",
          entityId: 1,
          worldId: 10,
          content: "commons body",
        },
        body,
      ),
    );
    skills.register(
      skillDefFromBody(
        {
          name: "research",
          description: "Private fork",
          entityId: 2,
          worldId: 20,
          content: "private body",
        },
        skillBodySchema.parse({ origin: "user", status: "active", allowed_tools: ["file_read"] }),
      ),
    );
    expect(skills.get("research")?.description).toBe("Private fork");
    expect(skills.get("research")?.allowed_tools).toEqual(["file_read"]);
    expect(skills.search("private").map((s) => s.name)).toEqual(["research"]);
    expect(skills.listActive()).toHaveLength(1);
  });
});
