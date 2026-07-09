import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  diaryAppendInputSchema,
  diaryCreateInputSchema,
  diaryListInputSchema,
} from "@freeanima/shared/sap-contract";

describe("diary SAP procedures", () => {
  it("registers diary.* methods", () => {
    expect(SAP_METHODS).toContain("diary.list");
    expect(SAP_METHODS).toContain("diary.create");
    expect(SAP_METHODS).toContain("diary.append");
    expect(SAP_METHODS).toContain("diary.patch");
    expect(SAP_METHODS).toContain("diary.delete");
    expect(SAP_METHODS).toContain("diary.get");
    expect(SAP_METHODS).toContain("diary.search");
  });

  it("validates diary procedure inputs", () => {
    diaryListInputSchema.parse({ subject_kind: "user" });
    diaryCreateInputSchema.parse({
      subject_kind: "agent",
      title: "今日思考",
      entry_at: "2026-06-29T20:00:00+08:00",
    });
    diaryAppendInputSchema.parse({
      subject_kind: "agent",
      id: 1,
      content: "追加段落",
    });
  });
});
