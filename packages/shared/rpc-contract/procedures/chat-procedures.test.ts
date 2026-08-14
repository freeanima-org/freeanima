import { describe, expect, it } from "bun:test";
import {
  RPC_PROTOCOL_METHODS,
  notificationListInputSchema,
  notificationMarkReadInputSchema,
  conversationCommandsInputSchema,
} from "@freeanima/shared/rpc-contract";

describe("chat SAP procedures", () => {
  it("registers conversation.commands, notification.*", () => {
    expect(RPC_PROTOCOL_METHODS).toContain("conversation.commands");
    expect(RPC_PROTOCOL_METHODS).toContain("conversation.commands");
    expect(RPC_PROTOCOL_METHODS).not.toContain("fridge.list");
    expect(RPC_PROTOCOL_METHODS).toContain("notification.list");
    expect(RPC_PROTOCOL_METHODS).toContain("notification.markRead");
  });

  it("validates chat procedure inputs", () => {
    conversationCommandsInputSchema.parse({ platform: "chat", all: false });
    notificationListInputSchema.parse({ recipient_kind: "agent", read_filter: "all" });
    notificationMarkReadInputSchema.parse({ id: "abc" });
  });
});
