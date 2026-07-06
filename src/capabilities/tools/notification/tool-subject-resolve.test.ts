import { describe, expect, it } from "bun:test";

import { bindResolvedWorldContext } from "@freeanima/core/config/world-context";
import { resolveNotificationSendTargets } from "./tool-subject-resolve.ts";

describe("notification tool subject resolve", () => {
  bindResolvedWorldContext({
    user_subject_id: 10,
    agent_subject_id: 20,
    user_world_id: 100,
    agent_world_id: 200,
  });

  it("send without subject_id defaults target both", async () => {
    const targets = await resolveNotificationSendTargets({
      title: "t",
      body: "b",
    });
    expect(targets).toEqual([
      { recipient_kind: "user", recipient_id: "10" },
      { recipient_kind: "agent", recipient_id: "20" },
    ]);
  });

  it("rejects unknown subject_id", async () => {
    const err = await resolveNotificationSendTargets({
      subject_id: 999,
      title: "t",
      body: "b",
    });
    expect(typeof err).toBe("string");
    expect(String(err)).toContain("not a configured");
  });
});
