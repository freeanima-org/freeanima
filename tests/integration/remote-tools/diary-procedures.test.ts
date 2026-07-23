import { describe, expect, it } from "bun:test";
import {
  RPC_PROTOCOL_METHODS,
  diaryAppendInputSchema,
  diaryBlockCreateInputSchema,
  diaryBlockReorderInputSchema,
  diaryCreateInputSchema,
  diaryListInputSchema,
  diaryPatchInputSchema,
} from "@freeanima/shared/rpc-contract";

describe("diary SAP procedures", () => {
  it("registers diary.* methods", () => {
    expect(RPC_PROTOCOL_METHODS).toContain("diary.list");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.create");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.append");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.patch");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.delete");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.get");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.search");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.blockCreate");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.blockPatch");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.blockDelete");
    expect(RPC_PROTOCOL_METHODS).toContain("diary.blockReorder");
  });

  it("validates diary procedure inputs", () => {
    diaryListInputSchema.parse({ subject_kind: "user" });
    diaryCreateInputSchema.parse({
      subject_kind: "agent",
      title: "今日思考",
      entry_at: "2026-06-29T20:00:00+08:00",
      content: "首段",
    });
    diaryAppendInputSchema.parse({
      subject_kind: "agent",
      id: 1,
      content: "追加块",
    });
    diaryPatchInputSchema.parse({
      subject_kind: "user",
      id: 1,
      tags: ["日常"],
    });
    diaryBlockCreateInputSchema.parse({
      subject_kind: "user",
      parent_id: 1,
      content: "新块",
    });
    diaryBlockReorderInputSchema.parse({
      subject_kind: "user",
      items: [{ id: 2, sort_order: 0 }],
    });
  });
});
