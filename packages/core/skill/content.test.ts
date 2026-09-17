import { describe, expect, it } from "bun:test";

import {
  normalizeToolList,
  parseFrontmatter,
  serializeSkillMarkdown,
  stripFrontmatter,
} from "./content.ts";

describe("skill content helpers", () => {
  it("parseFrontmatter reads agentskills fields", () => {
    const text = `---
name: demo
description: Demo skill
allowed-tools: file_read @browser
license: MIT
---

# Body`;
    const fm = parseFrontmatter(text);
    expect(fm.name).toBe("demo");
    expect(fm.description).toBe("Demo skill");
    expect(fm["allowed-tools"]).toBe("file_read @browser");
    expect(fm.license).toBe("MIT");
    expect(normalizeToolList(fm["allowed-tools"])).toEqual(["file_read", "@browser"]);
  });

  it("parseFrontmatter returns empty without header", () => {
    expect(parseFrontmatter("# no frontmatter")).toEqual({});
  });

  it("stripFrontmatter removes header block", () => {
    const text = "---\nname: x\n---\n\nHello\nworld";
    expect(stripFrontmatter(text)).toBe("Hello\nworld");
  });

  it("serializeSkillMarkdown roundtrips name and allowed-tools", () => {
    const md = serializeSkillMarkdown({
      name: "research",
      description: "Research",
      content: "# Hello",
      allowed_tools: ["memory_semantic_search", "@browser"],
      origin: "builtin",
      status: "active",
    });
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe("research");
    expect(normalizeToolList(fm["allowed-tools"])).toEqual(["memory_semantic_search", "@browser"]);
    expect(stripFrontmatter(md)).toContain("# Hello");
  });

  it("parseFrontmatter reads YAML array and metadata", () => {
    const text = `---
name: demo
description: Demo
allowed-tools:
  - file_read
  - "@browser"
metadata:
  freeanima.origin: builtin
denied_tools: ["shell_exec"]
---

# Body`;
    const fm = parseFrontmatter(text);
    expect(fm.name).toBe("demo");
    expect(fm["allowed-tools"]).toEqual(["file_read", "@browser"]);
    expect(fm.denied_tools).toEqual(["shell_exec"]);
    expect(fm.metadata?.["freeanima.origin"]).toBe("builtin");
  });
});
