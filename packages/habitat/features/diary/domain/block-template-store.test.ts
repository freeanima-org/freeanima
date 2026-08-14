import { describe, expect, test } from "bun:test";

import {
  CONTENT_BLOCK_COMPONENT,
  diaryBlockTemplateBodySchema,
  diaryBlockTemplatePresetSchema,
} from "@freeanima/habitat/core/db/schema/entity";

describe("diary_block_template preset", () => {
  test("preset 与模板名分层：body 只含 preset", () => {
    const body = diaryBlockTemplateBodySchema.parse({
      sort_order: 1,
      preset: {
        title: "块标题",
        content: "",
        components: [CONTENT_BLOCK_COMPONENT],
        tag_ids: [2],
      },
    });
    expect(body.preset.title).toBe("块标题");
    expect(body.preset.tag_ids).toEqual([2]);
    expect(body.client_op_id).toBeNull();
  });

  test("preset.components 缺 content_block 时由 normalize 侧补齐（schema 仍要求非空）", () => {
    const preset = diaryBlockTemplatePresetSchema.parse({
      title: "x",
      content: "",
      components: [CONTENT_BLOCK_COMPONENT],
      tag_ids: [],
    });
    expect(preset.components).toContain(CONTENT_BLOCK_COMPONENT);
  });
});
