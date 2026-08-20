import { describe, expect, test } from "bun:test";

import {
  SHELL_QUICK_ENTRY_COMPONENT,
  shellQuickEntryBodySchema,
  validateEntityBody,
  PROJECT_COMPONENT,
  projectBodySchema,
} from "@freeanima/habitat/core/db/schema/entity";
import { pickPromotedPrimaryComponent } from "@freeanima/habitat/core/db/schema/entity/components/index.ts";

describe("shell_quick_entry component", () => {
  test("body schema accepts quick_sort_order", () => {
    expect(shellQuickEntryBodySchema.parse({ quick_sort_order: 3 })).toEqual({
      quick_sort_order: 3,
    });
  });

  test("merges with project body without colliding keys", () => {
    const projectBody = projectBodySchema.parse({
      status: "active",
      folder_id: null,
      sort_order: 1,
    });
    const merged = validateEntityBody([PROJECT_COMPONENT, SHELL_QUICK_ENTRY_COMPONENT], {
      ...projectBody,
      quick_sort_order: 2,
    });
    expect(merged.quick_sort_order).toBe(2);
    expect(merged.status).toBe("active");
  });

  test("has very low primary promotion priority", () => {
    const promoted = pickPromotedPrimaryComponent([SHELL_QUICK_ENTRY_COMPONENT, PROJECT_COMPONENT]);
    expect(promoted).toBe(PROJECT_COMPONENT);
  });
});
