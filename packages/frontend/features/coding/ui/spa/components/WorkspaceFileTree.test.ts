import { describe, expect, test } from "bun:test";

import { entryBasename } from "./WorkspaceFileTree.tsx";

describe("entryBasename", () => {
  test("取最后一段", () => {
    expect(entryBasename(".agent/rules/coding.md")).toBe("coding.md");
    expect(entryBasename("src")).toBe("src");
    expect(entryBasename(".")).toBe(".");
  });

  test("兼容反斜杠", () => {
    expect(entryBasename("foo\\bar\\baz.ts")).toBe("baz.ts");
  });
});
