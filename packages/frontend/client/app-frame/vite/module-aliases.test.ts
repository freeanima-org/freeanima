import { describe, expect, test } from "bun:test";
import { resolveFreeanimaId } from "./module-aliases.ts";

const REPO_ROOT = new URL("../../../../..", import.meta.url).pathname.replace(/\/$/, "");

describe("resolveFreeanimaId", () => {
  test("目录 barrel 解析到 index.ts（含路径中带点的 worktree）", () => {
    expect(REPO_ROOT.includes(".")).toBe(true); // 例如 ~/.cursor/worktrees/...
    expect(resolveFreeanimaId(REPO_ROOT, "@freeanima/shared/rpc-contract")).toBe(
      `${REPO_ROOT}/packages/shared/rpc-contract/index.ts`,
    );
    expect(resolveFreeanimaId(REPO_ROOT, "@freeanima/ui-kit/composite")).toBe(
      `${REPO_ROOT}/packages/frontend/ui-kit/composite/index.ts`,
    );
  });
});
