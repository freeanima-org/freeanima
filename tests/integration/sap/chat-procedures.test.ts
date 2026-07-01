import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  notificationListInputSchema,
  notificationMarkReadInputSchema,
  sessionAcpDockInputSchema,
  conversationCommandsInputSchema,
} from "@freeanima/sap-contract";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

describe("chat SAP procedures", () => {
  it("registers conversation.acpDock, conversation.commands, notification.*", () => {
    expect(SAP_METHODS).toContain("conversation.acpDock");
    expect(SAP_METHODS).toContain("conversation.commands");
    expect(SAP_METHODS).not.toContain("fridge.list");
    expect(SAP_METHODS).toContain("notification.list");
    expect(SAP_METHODS).toContain("notification.markRead");
  });

  it("validates chat procedure inputs", () => {
    sessionAcpDockInputSchema.parse({ conversation_id: "20260101_120000_abc" });
    conversationCommandsInputSchema.parse({ platform: TEST_SAP_CHAT_PLATFORM, all: false });
    notificationListInputSchema.parse({ recipient_kind: "agent", read_filter: "all" });
    notificationMarkReadInputSchema.parse({ id: "abc" });
  });
});
