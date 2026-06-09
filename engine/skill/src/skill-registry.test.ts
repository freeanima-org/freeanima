import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

  it("registerSkillsFromDirectory 扫描 md 文件", () => {
    const dir = mkdtempSync(join(tmpdir(), "skill-dir-"));
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
    home = mkdtempSync(join(tmpdir(), "anima-skills-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("create / list / load / delete", () => {
    const created = JSON.parse(createUserSkill(skills, "demo", "测试技能", "做某事")) as {
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

    const searched = JSON.parse(searchSkillsForTool(skills, "测试"));
    expect(searched.total).toBeGreaterThan(0);

    const loaded = JSON.parse(loadSkillIntoContext(skills, "demo"));
    expect(loaded.content).toContain("做某事");
    expect(loaded.skill).toBe("demo");

    const deleted = JSON.parse(deleteUserSkill(skills, "demo")) as { ok: boolean; name: string };
    expect(deleted.ok).toBe(true);
    expect(deleted.name).toBe("demo");
    expect(skills.list().some((s) => s.name === "demo")).toBe(false);
  });

  it("不可删除内置技能", () => {
    skills.register({
      name: "builtin-x",
      description: "built-in",
      directory: "/pkg/skills",
      source: "acp",
    });
    const out = JSON.parse(deleteUserSkill(skills, "builtin-x")) as { error: string };
    expect(out.error).toContain("内置技能");
    skills.unregister("builtin-x");
  });
});
