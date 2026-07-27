import { describe, expect, it } from "bun:test";
import { resolvePreviewMotionPath } from "./MotionPreviewCanvas.tsx";

describe("resolvePreviewMotionPath", () => {
  it("keeps absolute /motions/{id}.vrma", () => {
    expect(resolvePreviewMotionPath("/motions/1014.vrma")).toBe("/motions/1014.vrma");
  });

  it("prefixes bare filename with baseUrl", () => {
    expect(resolvePreviewMotionPath("VRMA_01.vrma")).toBe("/motions/VRMA_01.vrma");
  });

  it("keeps http(s) URLs", () => {
    expect(resolvePreviewMotionPath("https://cdn.example/a.vrma")).toBe(
      "https://cdn.example/a.vrma",
    );
  });
});
