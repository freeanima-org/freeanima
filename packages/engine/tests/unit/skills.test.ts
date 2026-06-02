import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createSkill,
  loadSkill,
  listSkills,
  deleteSkill,
  getActiveSkillsContent,
} from "@freeanima/legacy-engine";

describe("skills", () => {
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

  it("create load list delete skill", () => {
    expect(createSkill("demo", "测试技能", "做某事")).toContain("已创建");
    expect(loadSkill("demo")).toContain("已加载");
    expect(listSkills()).toContain("demo");
    const injected = getActiveSkillsContent();
    expect(injected).toContain("demo");
    expect(deleteSkill("demo")).toContain("已删除");
  });
});
