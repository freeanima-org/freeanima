import { describe, expect, it } from "bun:test";

import { resolveNotificationRecipients } from "./notifications.ts";
import type { AnimaConfig } from "./schemas/config.ts";

describe("resolveNotificationRecipients", () => {
  it("uses configured subject entity ids from worlds", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      worlds: { user_subject_id: 2, agent_subject_id: 1 },
    } as AnimaConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "2" },
      agent: { kind: "agent", id: "1" },
    });
  });

  it("falls back to legacy notifications section", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      notifications: { user_subject_id: 3, agent_subject_id: 4 },
    } as AnimaConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "3" },
      agent: { kind: "agent", id: "4" },
    });
  });

  it("defaults to user=1 agent=2 when unset", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as AnimaConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "1" },
      agent: { kind: "agent", id: "2" },
    });
  });
});
