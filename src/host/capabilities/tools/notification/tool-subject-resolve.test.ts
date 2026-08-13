import { beforeEach, describe, expect, it } from "bun:test";

import { bindResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  resolveNotificationListSubject,
  resolveNotificationSendTargets,
} from "./tool-subject-resolve.ts";

const CTX = {
  user_subject_id: 10,
  agent_subject_id: 20,
  user_world_id: 100,
  agent_world_id: 200,
  commons_world_id: 30,
} as const;

describe("notification tool subject resolve", () => {
  beforeEach(() => {
    bindResolvedWorldContext({ ...CTX });
  });

  it("send without target or subject_id errors", async () => {
    const err = await resolveNotificationSendTargets({
      title: "t",
      body: "b",
    });
    expect(typeof err).toBe("string");
    expect(coerceString(err)).toContain("target or subject_id is required");
  });

  it("send with target both", async () => {
    const targets = await resolveNotificationSendTargets({
      title: "t",
      body: "b",
      target: "both",
    });
    expect(targets).toEqual([
      { recipient_kind: "user", recipient_id: "10" },
      { recipient_kind: "agent", recipient_id: "20" },
    ]);
  });

  it("list without recipient or subject_id errors", async () => {
    const err = await resolveNotificationListSubject({});
    expect(typeof err).toBe("string");
    expect(coerceString(err)).toContain("recipient or subject_id is required");
  });

  it("rejects unknown subject_id", async () => {
    const err = await resolveNotificationSendTargets({
      subject_id: 999,
      title: "t",
      body: "b",
    });
    expect(typeof err).toBe("string");
    expect(coerceString(err)).toContain("not a configured");
  });
});
