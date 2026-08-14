import { describe, expect, it } from "bun:test";
import {
  RPC_PROTOCOL_METHODS,
  noteAppendInputSchema,
  noteBlockCreateInputSchema,
  noteBlockReorderInputSchema,
  noteCreateInputSchema,
  noteListInputSchema,
  notePatchInputSchema,
  noteSearchInputSchema,
} from "@freeanima/shared/rpc-contract";

describe("note SAP procedures", () => {
  it("registers note.* methods", () => {
    expect(RPC_PROTOCOL_METHODS).toContain("note.list");
    expect(RPC_PROTOCOL_METHODS).toContain("note.create");
    expect(RPC_PROTOCOL_METHODS).toContain("note.append");
    expect(RPC_PROTOCOL_METHODS).toContain("note.patch");
    expect(RPC_PROTOCOL_METHODS).toContain("note.delete");
    expect(RPC_PROTOCOL_METHODS).toContain("note.get");
    expect(RPC_PROTOCOL_METHODS).toContain("note.search");
    expect(RPC_PROTOCOL_METHODS).toContain("note.blockCreate");
    expect(RPC_PROTOCOL_METHODS).toContain("note.blockPatch");
    expect(RPC_PROTOCOL_METHODS).toContain("note.blockDelete");
    expect(RPC_PROTOCOL_METHODS).toContain("note.blockReorder");
  });

  it("validates note procedure inputs", () => {
    noteListInputSchema.parse({ subject_kind: "user" });
    noteCreateInputSchema.parse({
      subject_kind: "agent",
      title: "会议纪要",
      content: "首段",
    });
    noteAppendInputSchema.parse({
      subject_kind: "agent",
      id: 1,
      content: "追加块",
    });
    notePatchInputSchema.parse({
      subject_kind: "user",
      id: 1,
      tags: ["工作"],
    });
    noteSearchInputSchema.parse({
      subject_kind: "user",
      query: "计划",
    });
    noteBlockCreateInputSchema.parse({
      subject_kind: "user",
      parent_id: 1,
      content: "新块",
    });
    noteBlockReorderInputSchema.parse({
      subject_kind: "user",
      items: [{ id: 2, sort_order: 0 }],
    });
  });
});
