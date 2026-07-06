import { describe, expect, it } from "bun:test";

import type { NotificationRow } from "@freeanima/core/repos";
import type { StoredMessage } from "@freeanima/core/db/domain";
import { storedMessagesToInvokeInput } from "@freeanima/core/llm/llm-adapt";

import {
  isNotificationContextAssistant,
  manifestNotificationContext,
  NOTIFICATION_CONTEXT_ASSISTANT_NAME,
  NOTIFICATION_HANDLING_PROTOCOL,
  stripNotificationContextFromMessages,
  wrapNotificationContext,
} from "./inject.ts";

function sampleRows(): NotificationRow[] {
  return [
    {
      id: "n-1",
      recipient_kind: "agent",
      recipient_id: "1",
      title: "任务到期",
      body: "整理收件箱",
      payload: null,
      read_at: null,
      created_at: "2026-06-28T08:00:00.000Z" as unknown as Date,
      source_kind: "system",
      source_ref: "task_item:1:trigger:2026-06-28T08:00:00.000Z",
    },
  ];
}

describe("notification inject", () => {
  it("manifests notification_context assistant before last user turn", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "self layer" },
      { role: "user", content: "hello" },
    ];
    manifestNotificationContext(messages, sampleRows());
    expect(messages).toHaveLength(3);
    expect(messages[1]).toMatchObject({
      role: "assistant",
      name: NOTIFICATION_CONTEXT_ASSISTANT_NAME,
    });
    expect(isNotificationContextAssistant(messages[1]!)).toBe(true);
    expect(messages[2]?.role).toBe("user");
  });

  it("includes handling protocol without source_kind in notification lines", () => {
    const content = wrapNotificationContext(sampleRows());
    expect(content).toContain(NOTIFICATION_HANDLING_PROTOCOL);
    expect(content).toContain("知晓即可");
    expect(content).toContain("[id:n-1]");
    expect(content).not.toMatch(/source_kind|source:/);
  });

  it("survives storedMessagesToInvokeInput (non-leading inject)", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "self layer" },
      { role: "user", content: "earlier" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "hello" },
    ];
    manifestNotificationContext(messages, sampleRows());

    const { turns, systemPrompt } = storedMessagesToInvokeInput(messages);
    expect(systemPrompt).toBe("self layer");
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "assistant", "user"]);
    expect(turns[2]).toMatchObject({
      role: "assistant",
      name: NOTIFICATION_CONTEXT_ASSISTANT_NAME,
    });
  });

  it("strips prior notification context before re-manifest", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "self layer" },
      {
        role: "assistant",
        name: NOTIFICATION_CONTEXT_ASSISTANT_NAME,
        content: wrapNotificationContext(sampleRows()),
      },
      { role: "user", content: "hello" },
    ];
    stripNotificationContextFromMessages(messages);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("no-op when last message is not user", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    manifestNotificationContext(messages, sampleRows());
    expect(messages).toHaveLength(2);
  });
});
