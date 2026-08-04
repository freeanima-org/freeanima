import { describe, expect, test } from "bun:test";

import { BUILTIN_SUBAGENT_SEEDS } from "./builtin-seeds.ts";

describe("BUILTIN_SUBAGENT_SEEDS", () => {
  test("coding-explorer 只读工具集不被破坏", () => {
    const seed = BUILTIN_SUBAGENT_SEEDS.find((s) => s.slug === "coding-explorer");
    expect(seed).toBeDefined();
    expect(seed!.allowed_tools).toEqual(["file_list", "file_read", "file_search"]);
    expect(seed!.denied_tools).toEqual(["file_patch", "file_write", "file_delete", "terminal_run"]);
  });
});
