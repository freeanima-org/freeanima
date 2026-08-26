import { describe, expect, it } from "bun:test";

import { isCodingOutpostAlive, type CodingOutpostRow } from "./ssh-connect.ts";

describe("isCodingOutpostAlive", () => {
  const rows: CodingOutpostRow[] = [
    { instance_id: "a", tool_count: 3 },
    { instance_id: "b", tool_count: 0 },
  ];

  it("requires matching id and tool_count > 0", () => {
    expect(isCodingOutpostAlive(rows, "a")).toBe(true);
    expect(isCodingOutpostAlive(rows, "b")).toBe(false);
    expect(isCodingOutpostAlive(rows, "missing")).toBe(false);
    expect(isCodingOutpostAlive(rows, null)).toBe(false);
  });
});
