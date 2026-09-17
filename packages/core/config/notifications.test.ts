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
      default_chat_agent_subject_id: 20,
      default_chat_agent_world_id: 200,
      commons_world_id: 30,
    });
    const config = {
      connections: {},
    } as RuntimeConfig;

    expect(resolveNotificationRecipients(config)).toEqual({
      user: { kind: "user", id: 10 },
      agent: { kind: "agent", id: 20 },
    });
  });

  it("throws when ResolvedWorldContext unbound", () => {
    const config = {
      connections: {},
    } as RuntimeConfig;

    expect(() => resolveNotificationRecipients(config)).toThrow(/ResolvedWorldContext not bound/);
  });
});
