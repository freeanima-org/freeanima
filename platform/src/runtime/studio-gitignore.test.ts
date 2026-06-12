import { describe, it, expect } from "bun:test";
import { isIgnored, parseGitignore } from "./studio-gitignore.ts";

describe("studio-gitignore", () => {
  it("parseGitignore handles negation and dir-only", () => {
    const rules = parseGitignore("*.log\n!important.log\nbuild/\n");
    expect(rules).toHaveLength(3);
    expect(isIgnored("debug.log", false, [rules])).toBe(true);
    expect(isIgnored("important.log", false, [rules])).toBe(false);
    expect(isIgnored("build", true, [rules])).toBe(true);
    expect(isIgnored("build/app.js", false, [rules])).toBe(false);
  });

  it("root-anchored /tmp/cursor-* does not ignore apps", () => {
    const rules = parseGitignore("/tmp/cursor-*/\n");
    expect(isIgnored("apps", true, [rules])).toBe(false);
    expect(isIgnored("packages", true, [rules])).toBe(false);
    expect(isIgnored("tmp/cursor-foo", true, [rules])).toBe(true);
  });
});
