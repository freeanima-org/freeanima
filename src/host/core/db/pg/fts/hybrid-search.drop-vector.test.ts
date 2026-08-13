import { describe, expect, it } from "bun:test";

import { dropVectorOnlyHits } from "./hybrid-search.ts";

describe("dropVectorOnlyHits", () => {
  it("keeps hits present in FTS or trgm", () => {
    const merged = [{ docKey: "a" }, { docKey: "b" }, { docKey: "c" }];
    const kept = dropVectorOnlyHits(merged, [[{ docKey: "a" }], [{ docKey: "c" }]]);
    expect(kept.map((h) => h.docKey)).toEqual(["a", "c"]);
  });

  it("drops vector-only keys", () => {
    const merged = [{ docKey: "vec-only" }, { docKey: "lex" }];
    const kept = dropVectorOnlyHits(merged, [[{ docKey: "lex" }], []]);
    expect(kept.map((h) => h.docKey)).toEqual(["lex"]);
  });
});
