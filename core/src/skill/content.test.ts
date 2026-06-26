import { describe, expect, it } from "bun:test";

import { parseFrontmatter, skillFilePath, stripFrontmatter } from "./content.ts";

describe("skill content helpers", () => {
  it("skillFilePath joins directory and name", () => {
    expect(skillFilePath("/skills", "demo")).toBe("/skills/demo.md");
  });

  it("parseFrontmatter reads yaml header", () => {
    const text = "---\nname: demo\ndescription: Demo skill\ncreated: 2026-01-01\n---\n\n# Body";
    expect(parseFrontmatter(text)).toEqual({
      name: "demo",
      description: "Demo skill",
      created: "2026-01-01",
    });
  });

  it("parseFrontmatter returns empty without header", () => {
    expect(parseFrontmatter("# no frontmatter")).toEqual({});
  });

  it("stripFrontmatter removes header block", () => {
    const text = "---\nname: x\n---\n\nHello\nworld";
    expect(stripFrontmatter(text)).toBe("Hello\nworld");
  });

  it("stripFrontmatter returns trimmed text when no header", () => {
    expect(stripFrontmatter("  plain  ")).toBe("plain");
  });
});
