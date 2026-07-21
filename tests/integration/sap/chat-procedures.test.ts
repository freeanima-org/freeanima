import { describe, expect, it } from "bun:test";
import {
  RPC_WIRE_METHODS,
  notificationListInputSchema,
  notificationMarkReadInputSchema,
  sessionAcpDockInputSchema,
  conversationCommandsInputSchema,
} from "@freeanima/shared/rpc-contract";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

describe("chat SAP procedures", () => {
  it("registers conversation.acpDock, conversation.commands, notification.*", () => {
    expect(RPC_WIRE_METHODS).toContain("conversation.acpDock");
    expect(RPC_WIRE_METHODS).toContain("conversation.commands");
    expect(RPC_WIRE_METHODS).not.toContain("fridge.list");
    expect(RPC_WIRE_METHODS).toContain("notification.list");
    expect(RPC_WIRE_METHODS).toContain("notification.markRead");
  });

  it("validates chat procedure inputs", () => {
    sessionAcpDockInputSchema.parse({ conversation_id: "20260101_120000_abc" });
    conversationCommandsInputSchema.parse({ platform: TEST_SAP_CHAT_PLATFORM, all: false });
    notificationListInputSchema.parse({ recipient_kind: "agent", read_filter: "all" });
    notificationMarkReadInputSchema.parse({ id: "abc" });
  });
});
