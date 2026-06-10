import { describe, it, expect } from "bun:test";
import { CURSOR_AUTO_MODEL_ID, resolveAcpModelId } from "./model.ts";

describe("resolveAcpModelId", () => {
  it("auto alias maps to default[]", () => {
    expect(resolveAcpModelId("auto", "cursor")).toBe(CURSOR_AUTO_MODEL_ID);
    expect(resolveAcpModelId("Auto", "generic")).toBe(CURSOR_AUTO_MODEL_ID);
  });

  it("cursor adapter defaults to Auto", () => {
    expect(resolveAcpModelId(undefined, "cursor")).toBe(CURSOR_AUTO_MODEL_ID);
  });

  it("non-cursor adapter does not set model by default", () => {
    expect(resolveAcpModelId(undefined, "generic")).toBeUndefined();
  });

  it("preserves explicit modelId", () => {
    expect(resolveAcpModelId("composer-2.5[fast=true]", "cursor")).toBe("composer-2.5[fast=true]");
  });
});
