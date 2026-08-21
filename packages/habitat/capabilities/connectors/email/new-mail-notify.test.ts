import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/world-context";
import {
  bucketNewMailSubjectsByWorld,
  buildNewMailNotificationContent,
} from "./new-mail-notify.ts";
import type { NewMailNotifyItem } from "@freeanima/features/email/domain";

function bindTestWorldContext(): void {
  bindResolvedWorldContext({
    user_world_id: 10,
    agent_world_id: 20,
    default_chat_agent_subject_id: 2,
    default_chat_agent_world_id: 20,
    commons_world_id: 30,
    user_subject_id: 1,
    agent_subject_id: 2,
  });
}

beforeEach(() => {
  bindTestWorldContext();
});

afterEach(() => {
  resetResolvedWorldContextForTest();
});

function mail(
  partial: Partial<NewMailNotifyItem> & Pick<NewMailNotifyItem, "message_id">,
): NewMailNotifyItem {
  return {
    message_id: partial.message_id,
    from: partial.from ?? "sender@example.com",
    subject: partial.subject ?? "Hello",
  };
}

describe("buildNewMailNotificationContent", () => {
  test("single mail includes from and message_id", () => {
    const { title, body } = buildNewMailNotificationContent([
      mail({ message_id: 42, from: "alice@example.com", subject: "Hello" }),
    ]);
    expect(title).toBe("新邮件：Hello");
    expect(body).toBe("from: alice@example.com\nmessage_id: 42\nsubject: Hello");
  });

  test("multiple mails are listed with from and message_id", () => {
    const { title, body } = buildNewMailNotificationContent([
      mail({ message_id: 1, from: "a@x.com", subject: "A" }),
      mail({ message_id: 2, from: "b@y.com", subject: "B" }),
      mail({ message_id: 3, from: "c@z.com", subject: "C" }),
    ]);
    expect(title).toBe("新邮件：3 封");
    expect(body).toContain("• from: a@x.com | message_id: 1 | subject: A");
    expect(body).toContain("• from: c@z.com | message_id: 3 | subject: C");
  });
});

describe("bucketNewMailSubjectsByWorld", () => {
  test("routes user and agent worlds separately", () => {
    const buckets = bucketNewMailSubjectsByWorld([
      {
        account_id: 1,
        world_id: 10,
        upserted_messages: 1,
        upserted_threads: 1,
        highest_uid: 1,
        new_mails: [mail({ message_id: 10, subject: "User mail" })],
      },
      {
        account_id: 2,
        world_id: 20,
        upserted_messages: 1,
        upserted_threads: 1,
        highest_uid: 1,
        new_mails: [mail({ message_id: 20, subject: "Agent mail" })],
      },
      {
        account_id: 3,
        world_id: 99,
        upserted_messages: 1,
        upserted_threads: 1,
        highest_uid: 1,
        new_mails: [mail({ message_id: 99, subject: "Unknown" })],
      },
    ]);
    expect(buckets).toEqual([
      { kind: "user", mails: [mail({ message_id: 10, subject: "User mail" })] },
      { kind: "agent", mails: [mail({ message_id: 20, subject: "Agent mail" })] },
    ]);
  });
});
