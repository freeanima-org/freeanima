import { describe, expect, test } from "bun:test";
import { bindResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import {
  bucketNewMailSubjectsByWorld,
  buildNewMailNotificationContent,
} from "./new-mail-notify.ts";

bindResolvedWorldContext({
  user_world_id: 10,
  agent_world_id: 20,
  user_subject_id: 1,
  agent_subject_id: 2,
});

describe("buildNewMailNotificationContent", () => {
  test("single subject becomes title", () => {
    const { title, body } = buildNewMailNotificationContent(["Hello"]);
    expect(title).toBe("新邮件：Hello");
    expect(body).toBe("Hello");
  });

  test("multiple subjects are listed", () => {
    const { title, body } = buildNewMailNotificationContent(["A", "B", "C"]);
    expect(title).toBe("新邮件：3 封");
    expect(body).toContain("• A");
    expect(body).toContain("• C");
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
        new_subjects: ["User mail"],
      },
      {
        account_id: 2,
        world_id: 20,
        upserted_messages: 1,
        upserted_threads: 1,
        highest_uid: 1,
        new_subjects: ["Agent mail"],
      },
      {
        account_id: 3,
        world_id: 99,
        upserted_messages: 1,
        upserted_threads: 1,
        highest_uid: 1,
        new_subjects: ["Unknown"],
      },
    ]);
    expect(buckets).toEqual([
      { kind: "user", subjects: ["User mail"] },
      { kind: "agent", subjects: ["Agent mail"] },
    ]);
  });
});
