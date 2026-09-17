import { describe, expect, it } from "bun:test";
import { autobiographicalDocKey, limbicDocKey, rrfMerge, semanticMemoryDocKey } from "./rrf.ts";

describe("rrfMerge", () => {
  it("merges ranked lists and limits output", () => {
    const semantic = [
      { docKey: semanticMemoryDocKey("a"), label: "semantic-a" },
      { docKey: semanticMemoryDocKey("b"), label: "semantic-b" },
    ];
    const limbic = [{ docKey: limbicDocKey("l1"), label: "limbic-l1" }];
    const merged = rrfMerge([semantic, limbic], { limit: 2 });
    expect(merged.length).toBe(2);
    expect(merged[0]!.score).toBeGreaterThan(0);
  });

  it("autobiographicalDocKey is stable", () => {
    expect(autobiographicalDocKey("ab-1")).toBe("ab:ab-1");
  });
});
