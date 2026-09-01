import { describe, expect, test } from "bun:test";

import {
  mergeComponentBody,
  stripRemovedComponentBodyFields,
  validateEntityBody,
  validatePrimaryComponentBody,
} from "./body.ts";
import { CONTENT_BLOCK_COMPONENT } from "./components/content-block.ts";
import { DIARY_BLOCK_TEMPLATE_COMPONENT } from "./components/diary-block-template.ts";
import { DIARY_ENTRY_COMPONENT } from "./components/diary-entry.ts";
import { DREAM_COMPONENT } from "./components/dream.ts";
import { LIMBIC_COMPONENT } from "./components/limbic.ts";
import { NARRATIVE_COMPONENT } from "./components/narrative.ts";
import { NOTE_COMPONENT } from "./components/note.ts";
import { SEMANTIC_REF_COMPONENT } from "./components/semantic-ref.ts";
import { TASK_ITEM_COMPONENT } from "./components/task-item.ts";
import { TEMPORAL_SUMMARY_COMPONENT } from "./components/temporal-summary.ts";

describe("validateEntityBody", () => {
  test("accepts valid task_item body", () => {
    const body = validatePrimaryComponentBody(TASK_ITEM_COMPONENT, {
      title: "Buy milk",
      status: "pending",
      priority: "high",
      list_id: 2,
    });
    expect(body.title).toBe("Buy milk");
    expect(body.status).toBe("pending");
  });

  test("rejects unknown component tag", () => {
    expect(() => validateEntityBody(["not_a_component"], {})).toThrow(/unknown component/);
  });

  test("rejects invalid task_item body", () => {
    expect(() =>
      validatePrimaryComponentBody(TASK_ITEM_COMPONENT, {
        title: "x",
        list_id: -1,
      }),
    ).toThrow(/invalid body for component task_item/);
  });

  test("mergeComponentBody validates merged result", () => {
    const merged = mergeComponentBody(
      { title: "a", status: "pending", priority: "none", list_id: 2 },
      { status: "completed" },
      [TASK_ITEM_COMPONENT],
    );
    expect(merged.status).toBe("completed");
  });

  test("accepts content_block body", () => {
    const body = validatePrimaryComponentBody(CONTENT_BLOCK_COMPONENT, {
      block_type: "text",
      parent_id: 10,
      sort_order: 0,
    });
    expect(body.block_type).toBe("text");
    expect(body.parent_id).toBe(10);
    expect(body.url).toBeNull();
  });

  test("accepts diary_block_template body with preset", () => {
    const body = validatePrimaryComponentBody(DIARY_BLOCK_TEMPLATE_COMPONENT, {
      sort_order: 0,
      preset: {
        title: "今日回顾",
        content: "",
        components: [CONTENT_BLOCK_COMPONENT],
        tag_ids: [],
      },
    });
    expect(body.sort_order).toBe(0);
    expect((body.preset as { title: string }).title).toBe("今日回顾");
  });

  test("rejects invalid content_block block_type", () => {
    expect(() =>
      validatePrimaryComponentBody(CONTENT_BLOCK_COMPONENT, {
        block_type: "markdown",
        parent_id: 10,
        sort_order: 0,
      }),
    ).toThrow(/invalid body for component content_block/);
  });

  test("accepts content_block with limbic and narrative tags", () => {
    const body = validateEntityBody(
      [CONTENT_BLOCK_COMPONENT, LIMBIC_COMPONENT, NARRATIVE_COMPONENT],
      {
        block_type: "text",
        parent_id: 10,
        sort_order: 1,
        valence: 0.2,
        arousal: 0.5,
        intensity: 0.7,
        significance: "milestone",
      },
    );
    expect(body.block_type).toBe("text");
    expect(body.valence).toBe(0.2);
    expect(body.significance).toBe("milestone");
  });

  test("accepts content_block with semantic_ref", () => {
    const body = validateEntityBody([CONTENT_BLOCK_COMPONENT, SEMANTIC_REF_COMPONENT], {
      block_type: "text",
      parent_id: 10,
      sort_order: 0,
      entity_id: 42,
    });
    expect(body.entity_id).toBe(42);
  });

  test("accepts content_block with dream tag", () => {
    const body = validateEntityBody([CONTENT_BLOCK_COMPONENT, DREAM_COMPONENT], {
      block_type: "text",
      parent_id: 10,
      sort_order: 0,
      source_limbic_ids: ["1"],
      source_conversation_ids: [],
      episodic_snippets: [],
    });
    expect(body.source_limbic_ids).toEqual(["1"]);
  });

  test("rejects limbic out of range on multi-tag body", () => {
    expect(() =>
      validateEntityBody([CONTENT_BLOCK_COMPONENT, LIMBIC_COMPONENT], {
        block_type: "text",
        parent_id: 10,
        sort_order: 0,
        valence: 2,
        arousal: 0.5,
        intensity: 0.5,
      }),
    ).toThrow(/invalid body for component limbic/);
  });

  test("accepts temporal_summary body", () => {
    expect(
      validateEntityBody([TEMPORAL_SUMMARY_COMPONENT], {
        window: "day",
        period_start: "2026-07-18",
      }),
    ).toMatchObject({ window: "day", period_start: "2026-07-18" });
  });
});

describe("stripRemovedComponentBodyFields", () => {
  test("note+diary_entry: detach note keeps diary entry_at（client_op_id 已升实体列，不在 body）", () => {
    const body = {
      entry_at: "2026-08-19T00:00:00.000+08:00",
    };
    const next = stripRemovedComponentBodyFields(body, NOTE_COMPONENT, [DIARY_ENTRY_COMPONENT]);
    expect(next.entry_at).toBe(body.entry_at);
  });

  test("note+diary_entry: detach diary_entry drops entry_at", () => {
    const body = {
      entry_at: "2026-08-19T00:00:00.000+08:00",
    };
    const next = stripRemovedComponentBodyFields(body, DIARY_ENTRY_COMPONENT, [NOTE_COMPONENT]);
    expect(next.entry_at).toBeUndefined();
  });
});
