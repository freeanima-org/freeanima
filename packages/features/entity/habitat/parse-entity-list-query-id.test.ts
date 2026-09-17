import { describe, expect, it } from "bun:test";

import { parseEntityListQueryId } from "./parse-entity-list-query-id.ts";

describe("parseEntityListQueryId", () => {
  it("parses pure positive integer ids", () => {
    expect(parseEntityListQueryId("42")).toBe(42);
    expect(parseEntityListQueryId("  7  ")).toBe(7);
  });

  it("rejects non-positive or non-integer numeric strings", () => {
    expect(parseEntityListQueryId("0")).toBeNull();
    expect(parseEntityListQueryId("-1")).toBeNull();
    expect(parseEntityListQueryId("3.14")).toBeNull();
    expect(parseEntityListQueryId("01a")).toBeNull();
  });

  it("parses anima:{id} with optional query or hash", () => {
    expect(parseEntityListQueryId("anima:42")).toBe(42);
    expect(parseEntityListQueryId("anima:99?component=task_item")).toBe(99);
    expect(parseEntityListQueryId("anima:12#frag")).toBe(12);
  });

  it("rejects anima:// and keyword queries", () => {
    expect(parseEntityListQueryId("anima://42")).toBeNull();
    expect(parseEntityListQueryId("hello")).toBeNull();
    expect(parseEntityListQueryId("42 notes")).toBeNull();
    expect(parseEntityListQueryId("")).toBeNull();
    expect(parseEntityListQueryId("   ")).toBeNull();
  });
});
