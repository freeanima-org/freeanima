import { describe, expect, it } from "bun:test";

import { codingNoteBodySchema } from "@freeanima/host/core/db/schema/entity/components/coding-note.ts";

import { buildCreatePublicProjectWorldInput } from "./resolve-project-world.ts";

describe("coding note + project world helpers", () => {
  it("coding_note body 与 public world 输入可组合", () => {
    const world = buildCreatePublicProjectWorldInput({
      stable_key: "manual:note-test",
      title: "Note Test",
    });
    expect(world.private).toBe(false);
    expect(world.stable_key).toBe("manual:note-test");
    const body = codingNoteBodySchema.parse({ kind: "explore" });
    expect(body.kind).toBe("explore");
  });
});
