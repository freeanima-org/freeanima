import { describe, expect, it } from "bun:test";

import {
  COMPONENT_PRIMARY_PRIORITY,
  pickPromotedPrimaryComponent,
  stripRemovedComponentBodyFields,
  CONTENT_BLOCK_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  TASK_ITEM_COMPONENT,
  TAG_COMPONENT,
} from "@freeanima/host/core/db/schema/entity";

describe("pickPromotedPrimaryComponent", () => {
  it("空列表返回 null（空壳）", () => {
    expect(pickPromotedPrimaryComponent([])).toBeNull();
  });

  it("按 COMPONENT_PRIMARY_PRIORITY 选最高优先", () => {
    const picked = pickPromotedPrimaryComponent([TAG_COMPONENT, TASK_ITEM_COMPONENT]);
    expect(picked).toBe(TASK_ITEM_COMPONENT);
    expect(COMPONENT_PRIMARY_PRIORITY[TASK_ITEM_COMPONENT]).toBeLessThan(
      COMPONENT_PRIMARY_PRIORITY[TAG_COMPONENT],
    );
  });
});

describe("stripRemovedComponentBodyFields", () => {
  it("去掉仅属于被删组件的字段，保留共享或其它组件字段", () => {
    const body = {
      block_type: "text",
      parent_id: 1,
      sort_order: 0,
      valence: 0.2,
      arousal: 0.3,
      intensity: 0.4,
      significance: 0.5,
    };
    const next = stripRemovedComponentBodyFields(body, LIMBIC_COMPONENT, [
      CONTENT_BLOCK_COMPONENT,
      NARRATIVE_COMPONENT,
    ]);
    expect(next.valence).toBeUndefined();
    expect(next.arousal).toBeUndefined();
    expect(next.intensity).toBeUndefined();
    expect(next.block_type).toBe("text");
    expect(next.significance).toBe(0.5);
  });
});
