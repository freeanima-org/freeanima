import { describe, expect, it } from "bun:test";

import {
  DEFAULT_ENTITY_REVISION_LIMIT,
  isEntityRevisionPrimaryComponent,
  parseEntityRevisions,
  pushEntityRevision,
  shouldRecordEntityRevision,
  snapshotEntityRevision,
} from "./revisions.ts";

describe("entity revisions helpers", () => {
  it("allowlist includes vault_item and smart_list", () => {
    expect(isEntityRevisionPrimaryComponent("vault_item")).toBe(true);
    expect(isEntityRevisionPrimaryComponent("smart_list")).toBe(true);
    expect(isEntityRevisionPrimaryComponent("vault_config")).toBe(false);
  });

  it("pushEntityRevision unshifts and prunes to limit", () => {
    const base = snapshotEntityRevision({
      title: "a",
      summary: "",
      content: "",
      body: { v: 1 },
      tag_ids: [],
      pinned: false,
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    });
    let revs = [base];
    for (let i = 0; i < 12; i++) {
      revs = pushEntityRevision(
        revs,
        snapshotEntityRevision({
          title: `t${i}`,
          summary: "",
          content: "",
          body: { i },
          tag_ids: [],
          pinned: false,
          updated_at: new Date(`2026-01-${String(i + 2).padStart(2, "0")}T00:00:00.000Z`),
        }),
      );
    }
    expect(revs).toHaveLength(DEFAULT_ENTITY_REVISION_LIMIT);
    expect(revs[0]?.title).toBe("t11");
  });

  it("shouldRecordEntityRevision ignores reference_count / world_id only", () => {
    expect(shouldRecordEntityRevision({ reference_count: 1 })).toBe(false);
    expect(shouldRecordEntityRevision({ world_id: 2 })).toBe(false);
    expect(shouldRecordEntityRevision({ body: { x: 1 } })).toBe(true);
    expect(shouldRecordEntityRevision({ pinned: true })).toBe(true);
  });

  it("parseEntityRevisions drops invalid entries", () => {
    const parsed = parseEntityRevisions([
      {
        captured_at: "2026-01-01T00:00:00.000Z",
        title: "ok",
        summary: "",
        content: "",
        body: {},
        tag_ids: [],
        pinned: false,
      },
      { bad: true },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("ok");
  });
});
