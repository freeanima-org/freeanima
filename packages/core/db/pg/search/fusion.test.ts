import { describe, expect, it } from "bun:test";

import { fuseSearchHits } from "./fusion.ts";
import type { SearchHit } from "./types.ts";
import { UnsupportedSearchChannelError } from "./types.ts";
import { createPgBusinessScanBackend } from "./pg-business-scan.ts";

function hit(doc_key: string, score: number, channel: "fts" | "trgm"): SearchHit {
  return {
    doc_key,
    source_id: doc_key.replace(/^(ent:|msg:)/, ""),
    resource: doc_key.startsWith("msg:") ? "message" : "entity",
    score,
    channels_hit: [channel],
    channel_scores: { [channel]: score },
  };
}

describe("fuseSearchHits", () => {
  it("merges fts and trgm with RRF", () => {
    const merged = fuseSearchHits(
      {
        fts: [hit("ent:1", 1, "fts"), hit("ent:2", 0.5, "fts")],
        trgm: [hit("ent:2", 1, "trgm"), hit("ent:3", 0.5, "trgm")],
      },
      { limit: 10, fuse: "rrf" },
    );
    expect(merged.map((h) => h.doc_key)).toContain("ent:2");
    expect(merged[0]?.channels_hit?.length).toBeGreaterThan(0);
  });
});

describe("PgBusinessScan", () => {
  it("rejects unsupported channels explicitly", async () => {
    const backend = createPgBusinessScanBackend();
    await expect(
      backend.search({
        text: "hello",
        filters: { resource: "entity" },
        channels: ["fts"],
      }),
    ).rejects.toBeInstanceOf(UnsupportedSearchChannelError);
  });
});
