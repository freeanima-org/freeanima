import { describe, expect, it } from "bun:test";
import { createHook, Hook } from "./hook";

describe("createHook", () => {
  it("设置 qualifiedId 与 description", () => {
    const hook = createHook("@freeanima/hooks/test/id", "展示文案");
    expect(hook.qualifiedId).toBe("@freeanima/hooks/test/id");
    expect(hook.description).toBe("展示文案");
    expect(hook.id.description).toBe("@freeanima/hooks/test/id");
  });

  it("未传 description 时为 undefined", () => {
    const hook = createHook("@freeanima/hooks/test/no-desc");
    expect(hook.description).toBeUndefined();
  });

  it("每次创建产生独立的 Symbol id", () => {
    const a = createHook("@freeanima/hooks/test/same-id");
    const b = createHook("@freeanima/hooks/test/same-id");
    expect(a.id).not.toBe(b.id);
    expect(a.id.description).toBe(b.id.description);
  });

  it("不同 qualifiedId 产生不同 Symbol", () => {
    const a = createHook("@freeanima/hooks/test/a");
    const b = createHook("@freeanima/hooks/test/b");
    expect(a.id).not.toBe(b.id);
  });

  it("返回 Hook 实例", () => {
    const hook = createHook<{ n: number }>("@freeanima/hooks/test/instance");
    expect(hook).toBeInstanceOf(Hook);
  });
});
