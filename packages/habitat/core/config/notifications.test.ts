import { afterEach, describe, expect, it } from "bun:test";

import { resolveNotificationRecipients } from "./notifications.ts";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "./resolved-world-context.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

describe("resolveNotificationRecipients", () => {
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("uses ResolvedWorldContext when bound", () => {
    bindResolvedWorldContext({
      user_subject_id: 10,
      agent_subject_id: 20,
      user_world_id: 11,
      agent_world_id: 21,
      commons_world_id: 30,
    });
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      worlds: { user_subject_id: 2, agent_subject_id: 1 },
    } as RuntimeConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "10" },
      agent: { kind: "agent", id: "20" },
    });
  });

  it("uses configured subject entity ids from worlds when unbound", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      worlds: { user_subject_id: 2, agent_subject_id: 1 },
    } as RuntimeConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "2" },
      agent: { kind: "agent", id: "1" },
    });
  });

  it("falls back to legacy notifications section when unbound", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      notifications: { user_subject_id: 3, agent_subject_id: 4 },
    } as RuntimeConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: "3" },
      agent: { kind: "agent", id: "4" },
    });
  });

  it("throws when unset and unbound", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as RuntimeConfig;

    expect(() => resolveNotificationRecipients(config)).toThrow(/未解析/);
  });
});
