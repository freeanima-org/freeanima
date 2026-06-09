import { describe, expect, it } from "bun:test";
import { BackendRegistry } from "./backend.ts";
import { MockBackend } from "./test-helpers/mock-backend.ts";

describe("BackendRegistry", () => {
  it("registers and retrieves backends", () => {
    const reg = new BackendRegistry();
    const backend = new MockBackend({ id: "b1" });
    reg.register(backend);
    expect(reg.has("b1")).toBe(true);
    expect(reg.get("b1")).toBe(backend);
    expect(reg.list()).toEqual([backend]);
  });

  it("rejects duplicate registration", () => {
    const reg = new BackendRegistry();
    reg.register(new MockBackend({ id: "dup" }));
    expect(() => reg.register(new MockBackend({ id: "dup" }))).toThrow(
      'backend adapter "dup" 已注册',
    );
  });

  it("throws when backend missing", () => {
    const reg = new BackendRegistry();
    expect(() => reg.get("missing")).toThrow("未找到 backend adapter: missing");
  });
});
