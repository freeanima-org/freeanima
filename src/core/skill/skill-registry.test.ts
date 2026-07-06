import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  SkillRegistry,
  createUserSkill,
  deleteUserSkill,
  loadSkillIntoContext,
  listSkillsForTool,
  registerSkillsFromDirectory,
  searchSkillsForTool,
  USER_SKILLS_SOURCE,
  registerUserSkillsFromHome,
} from "./index.ts";

describe("SkillRegistry", () => {
  const skills = new SkillRegistry();
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("register / list / search", () => {
    skills.register({
      name: "demo-a",
      description: "Alpha skill",
      directory: "/tmp/skills-a",
      source: "test",
    });
    skills.register({
      name: "demo-b",
      description: "Beta helper",
      directory: "/tmp/skills-b",
      source: "test",
    });

    expect(skills.list().map((s) => s.name)).toContain("demo-a");
    expect(skills.search("beta").map((s) => s.name)).toContain("demo-b");
    expect(skills.search("missing")).toHaveLength(0);

    skills.unregister("demo-a");
    skills.unregister("demo-b");
  });

  it("registerSkillsFromDirectory scans md files", () => {
    const dir = createTempDir("skill-dir-");
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "scan-me.md"),
      "---\nname: scan-me\ndescription: From dir\n---\n\n# Body\n",
    );
    const count = registerSkillsFromDirectory(skills, dir, { source: "pkg:test" });
    expect(count).toBe(1);
    expect(skills.search("scan-me")[0]?.description).toBe("From dir");
    skills.unregister("scan-me");
  });
});

describe("user skills", () => {
  const skills = new SkillRegistry();
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = createTempDir("anima-skills-");
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
    removeTempDir(home);
  });

  it("create / list / load / delete", () => {
    const created = JSON.parse(createUserSkill(skills, "demo", "test skill", "do something")) as {
      ok: boolean;
      name: string;
    };
    expect(created.ok).toBe(true);
    expect(created.name).toBe("demo");
    registerUserSkillsFromHome(skills);
    expect(skills.list().some((s) => s.name === "demo" && s.source === USER_SKILLS_SOURCE)).toBe(
      true,
    );

    const listed = JSON.parse(listSkillsForTool(skills));
    expect(listed.skills.some((s: { name: string }) => s.name === "demo")).toBe(true);

    const searched = JSON.parse(searchSkillsForTool(skills, "test"));
    expect(searched.total).toBeGreaterThan(0);

    const loaded = JSON.parse(loadSkillIntoContext(skills, "demo"));
    expect(loaded.content).toContain("do something");
    expect(loaded.skill).toBe("demo");

    const deleted = JSON.parse(deleteUserSkill(skills, "demo")) as { ok: boolean; name: string };
    expect(deleted.ok).toBe(true);
    expect(deleted.name).toBe("demo");
    expect(skills.list().some((s) => s.name === "demo")).toBe(false);
  });

  it("cannot delete built-in skill", () => {
    skills.register({
      name: "builtin-x",
      description: "built-in",
      directory: "/pkg/skills",
      source: "acp",
    });
    const out = JSON.parse(deleteUserSkill(skills, "builtin-x")) as { error: string };
    expect(out.error).toContain("built-in skill");
    skills.unregister("builtin-x");
  });
});
