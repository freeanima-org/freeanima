import { describe, expect, it } from "bun:test";
import {
  RPC_PROTOCOL_METHODS,
  emailMessageSearchInputSchema,
  taskSearchInputSchema,
} from "@freeanima/shared/rpc-contract";

describe("task/email SAP search procedures", () => {
  it("registers task.search and email.message.search", () => {
    expect(RPC_PROTOCOL_METHODS).toContain("task.search");
    expect(RPC_PROTOCOL_METHODS).toContain("email.message.search");
  });

  it("validates task.search input", () => {
    taskSearchInputSchema.parse({
      subject_id: 1,
      query: "买牛奶",
      list_id: 3,
      status: "pending",
      limit: 20,
    });
  });

  it("validates email.message.search input", () => {
    emailMessageSearchInputSchema.parse({
      subject_id: 2,
      query: "invoice",
      account_id: 1,
      limit: 10,
    });
    emailMessageSearchInputSchema.parse({
      subject_id: 2,
      mailbox: "INBOX",
      flagged: true,
      limit: 10,
    });
  });
});
