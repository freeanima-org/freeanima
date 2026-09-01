import { describe, expect, test } from "bun:test";

import type { EntityRow } from "@freeanima/habitat/core/db/pg/entity";
import {
  AGENT_CONFIG_COMPONENT,
  NOTE_COMPONENT,
  DIARY_ENTRY_COMPONENT,
} from "@freeanima/habitat/core/db/schema/entity";

import { EntityAttachError, assertAttachAllowed, assertPromoteAllowed } from "./attach-policy.ts";

function baseContent(overrides: Partial<EntityRow> = {}): EntityRow {
  return {
    id: 10,
    type: "content",
    world_id: 1,
    components: [NOTE_COMPONENT],
    primary_component: NOTE_COMPONENT,
    title: "n",
    summary: "",
    content: "",
    body: {},
    client_op_id: null,
    pinned: false,
    reference_count: 0,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("assertAttachAllowed", () => {
  test("allows attaching diary_entry onto content note", () => {
    expect(() => assertAttachAllowed(baseContent(), DIARY_ENTRY_COMPONENT)).not.toThrow();
  });

  test("rejects non-content", () => {
    expect(() =>
      assertAttachAllowed(baseContent({ type: "world" }), DIARY_ENTRY_COMPONENT),
    ).toThrow(EntityAttachError);
  });

  test("rejects deleted", () => {
    expect(() =>
      assertAttachAllowed(baseContent({ deleted_at: new Date() }), DIARY_ENTRY_COMPONENT),
    ).toThrow(/deleted/);
  });

  test("rejects identity component", () => {
    expect(() => assertAttachAllowed(baseContent(), AGENT_CONFIG_COMPONENT)).toThrow(/identity/);
  });

  test("rejects unknown component", () => {
    expect(() => assertAttachAllowed(baseContent(), "not_a_component")).toThrow(/unknown/);
  });
});

describe("assertPromoteAllowed", () => {
  test("allows promoting existing secondary", () => {
    const row = baseContent({
      components: [NOTE_COMPONENT, DIARY_ENTRY_COMPONENT],
      primary_component: NOTE_COMPONENT,
    });
    expect(() => assertPromoteAllowed(row, DIARY_ENTRY_COMPONENT)).not.toThrow();
  });

  test("rejects component not present", () => {
    expect(() => assertPromoteAllowed(baseContent(), DIARY_ENTRY_COMPONENT)).toThrow(/not present/);
  });
});
