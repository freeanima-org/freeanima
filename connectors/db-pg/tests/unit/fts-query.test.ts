import { describe, it, expect } from "bun:test";
import { buildPgTsQuery } from "../../src/session/fts-query.ts";

describe("buildPgTsQuery", () => {
  it("joins tokens with OR by default", () => {
    expect(buildPgTsQuery("Free Anima")).toBe("Free | Anima");
  });

  it("maps explicit AND/OR/NOT", () => {
    expect(buildPgTsQuery("Free AND Anima")).toBe("Free & Anima");
    expect(buildPgTsQuery("Free OR Anima")).toBe("Free | Anima");
    expect(buildPgTsQuery("Free NOT Anima")).toBe("Free ! Anima");
  });

  it("handles CJK phrase with per-char OR", () => {
    expect(buildPgTsQuery("逸灵风")).toBe("逸 | 灵 | 风");
  });

  it("preserves quoted phrase", () => {
    expect(buildPgTsQuery('"逸灵风"')).toBe("逸 | 灵 | 风");
  });
});
