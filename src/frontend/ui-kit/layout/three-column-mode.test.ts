import { describe, expect, test } from "bun:test";

import type { ThreeColumnLayoutMode } from "./three-column-mode.ts";

describe("ThreeColumnLayoutMode", () => {
  test("仅 compact 与 wide 两档", () => {
    const modes: ThreeColumnLayoutMode[] = ["compact", "wide"];
    expect(modes).toHaveLength(2);
    expect(modes).not.toContain("medium" as ThreeColumnLayoutMode);
  });
});
