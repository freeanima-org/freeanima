import { afterEach, describe, expect, it } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/core/util/temp-dir";
import { SkillRegistry } from "./registry.ts";
import {
  formatSkillsPrefix,
  listSkillsForTool,
  loadSkillIntoContext,
  prependSkillsToPrompt,
  searchSkillsForTool,
} from "./tools.ts";

describe("skill tools", () => {
  const skills = new SkillRegistry();
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
    skills.unregister("fmt-skill");
  });

  function registerSkillWithBody(body: string): void {
    const dir = createTempDir("skill-tools-");
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "fmt-skill.md"),
      `---\nname: fmt-skill\ndescription: fmt\n---\n\n${body}`,
    );
    skills.register({
      name: "fmt-skill",
      description: "fmt",
      directory: dir,
      source: "test",
    });
  }

  it("loadSkillIntoContext validates name and content", () => {
    expect(loadSkillIntoContext(skills, "  ")).toContain("cannot be empty");
    expect(loadSkillIntoContext(skills, "missing")).toContain("not registered");
  });

  it("listSkillsForTool returns empty message", () => {
    const empty = new SkillRegistry();
    const out = JSON.parse(listSkillsForTool(empty));
    expect(out.total).toBe(0);
    expect(out.message).toContain("No registered");
  });

  it("searchSkillsForTool wraps registry search", () => {
    registerSkillWithBody("searchable body");
    const out = JSON.parse(searchSkillsForTool(skills, "fmt"));
    expect(out.total).toBe(1);
    expect(out.skills[0]?.name).toBe("fmt-skill");
  });

  it("formatSkillsPrefix and prependSkillsToPrompt wrap skill bodies", () => {
    registerSkillWithBody("skill body");
    expect(formatSkillsPrefix(skills, ["fmt-skill"])).toContain('<skill name="fmt-skill">');
    expect(prependSkillsToPrompt(skills, "prompt", ["fmt-skill"])).toMatch(
      /<skill name="fmt-skill">[\s\S]+prompt$/,
    );
    expect(prependSkillsToPrompt(skills, "prompt", ["missing"])).toBe("prompt");
  });
});
