import { describe, it, expect } from "bun:test";
import { renderTable } from "../../src/output/table.ts";

// credential 子命令需 mock @freeanima/legacy-kernel；Bun mock.module 当前会卡住，先跳过
describe.skip("credential CLI", () => {
  it.todo("list / get / add 待 mock.module 稳定后恢复", () => {});
});

describe("renderTable", () => {
  it("truncates long cells", () => {
    const table = renderTable([["x".repeat(60)]], ["Path"]);
    expect(table).toContain("…");
  });
});
