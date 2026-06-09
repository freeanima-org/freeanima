import { describe, it, expect } from "bun:test";
import { CURSOR_AUTO_MODEL_ID, resolveAcpModelId } from "./model.ts";

describe("resolveAcpModelId", () => {
  it("auto 别名映射为 default[]", () => {
    expect(resolveAcpModelId("auto", "cursor")).toBe(CURSOR_AUTO_MODEL_ID);
    expect(resolveAcpModelId("Auto", "generic")).toBe(CURSOR_AUTO_MODEL_ID);
  });

  it("cursor 适配器缺省为 Auto", () => {
    expect(resolveAcpModelId(undefined, "cursor")).toBe(CURSOR_AUTO_MODEL_ID);
  });

  it("非 cursor 适配器缺省不设置模型", () => {
    expect(resolveAcpModelId(undefined, "generic")).toBeUndefined();
  });

  it("保留显式 modelId", () => {
    expect(resolveAcpModelId("composer-2.5[fast=true]", "cursor")).toBe("composer-2.5[fast=true]");
  });
});
