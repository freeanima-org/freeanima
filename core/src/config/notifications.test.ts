import { describe, expect, it } from "bun:test";

import { resolveNotificationRecipients } from "./notifications.ts";
import type { AnimaConfig } from "./schemas/config.ts";

describe("resolveNotificationRecipients", () => {
  it("uses configured subject entity ids", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      notifications: { user_subject_id: 2, agent_subject_id: 1 },
    } as AnimaConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "2" },
      agent: { kind: "agent", id: "1" },
    });
  });

  it("falls back to default recipient id when unset", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as AnimaConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "default" },
      agent: { kind: "agent", id: "default" },
    });
  });
});
