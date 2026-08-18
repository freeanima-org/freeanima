import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

describe("calibrateSemanticMemoryClusters", () => {
  it("does not warm cluster titles in the same step", () => {
    const src = readFileSync(new URL("./calibrate.ts", import.meta.url), "utf8");
    expect(src).not.toContain("warmSemanticClusterTitles");
    expect(src).not.toContain("cluster-title");
  });
});
