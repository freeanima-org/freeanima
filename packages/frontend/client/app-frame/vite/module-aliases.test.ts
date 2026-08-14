import { describe, expect, test } from "bun:test";
import { resolveFreeanimaId } from "./module-aliases.ts";

const REPO_ROOT = new URL("../../../../..", import.meta.url).pathname.replace(/\/$/, "");

describe("resolveFreeanimaId", () => {
  test("目录 barrel 解析到 index.ts（不以 path.includes('.') 误判扩展名）", () => {
    // tryFile 用 statSync 区分目录；路径可含点（如 ~/.cursor/worktrees）亦可不含
    expect(resolveFreeanimaId(REPO_ROOT, "@freeanima/shared/rpc-contract")).toBe(
      `${REPO_ROOT}/packages/shared/rpc-contract/index.ts`,
    );
    expect(resolveFreeanimaId(REPO_ROOT, "@freeanima/ui-kit/composite")).toBe(
      `${REPO_ROOT}/packages/frontend/ui-kit/composite/index.ts`,
    );
  });
});
