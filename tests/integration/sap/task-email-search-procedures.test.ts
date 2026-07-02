import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  emailMessageSearchInputSchema,
  taskSearchInputSchema,
} from "@freeanima/sap-contract";

describe("task/email SAP search procedures", () => {
  it("registers task.search and email.message.search", () => {
    expect(SAP_METHODS).toContain("task.search");
    expect(SAP_METHODS).toContain("email.message.search");
  });

  it("validates task.search input", () => {
    taskSearchInputSchema.parse({
      subject_kind: "user",
      query: "买牛奶",
      list_id: 3,
      status: "pending",
      limit: 20,
    });
  });

  it("validates email.message.search input", () => {
    emailMessageSearchInputSchema.parse({
      subject_kind: "agent",
      query: "invoice",
      account_id: 1,
      limit: 10,
    });
  });
});
