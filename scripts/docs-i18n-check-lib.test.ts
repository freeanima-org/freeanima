import { describe, expect, test } from "bun:test";
import { checkMarkdownI18n, hasFrontmatterTitle } from "./docs-i18n-check-lib.ts";

describe("docs-i18n-check-lib", () => {
  test("hasFrontmatterTitle accepts title in YFM", () => {
    expect(hasFrontmatterTitle("---\ntitle: Example\n---\n\n# Hi\n")).toBe(true);
  });

  test("accepts fenced code block with language tag", () => {
    const content = "---\ntitle: X\n---\n\n```bash\nanima --help\n```\n";
    expect(checkMarkdownI18n(content, "docs/x.md")).toEqual([]);
  });

  test("flags unclosed fence", () => {
    const content = "---\ntitle: X\n---\n\n```bash\nanima --help\n";
    expect(
      checkMarkdownI18n(content, "docs/x.md").some((i) => i.message.includes("unclosed")),
    ).toBe(true);
  });
});
