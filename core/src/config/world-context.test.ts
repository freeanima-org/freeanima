import { afterEach, describe, expect, it } from "bun:test";

import { resolveWorldSubjectIds } from "./worlds.ts";
import {
  bindResolvedWorldContext,
  getResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "./world-context.ts";
import type { AnimaConfig } from "./schemas/config.ts";

describe("resolveWorldSubjectIds", () => {
  it("defaults to user=1 agent=2", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as AnimaConfig;
    expect(resolveWorldSubjectIds(config)).toEqual({
      user_subject_id: 1,
      agent_subject_id: 2,
    });
  });

  it("prefers worlds section over notifications", () => {
    const config = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
      worlds: { user_subject_id: 5, agent_subject_id: 6 },
      notifications: { user_subject_id: 1, agent_subject_id: 2 },
    } as AnimaConfig;
    expect(resolveWorldSubjectIds(config)).toEqual({
      user_subject_id: 5,
      agent_subject_id: 6,
    });
  });
});

describe("ResolvedWorldContext", () => {
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("binds and reads four ids", () => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
    });
    expect(getResolvedWorldContext()).toEqual({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
    });
  });

  it("throws when unbound", () => {
    expect(() => getResolvedWorldContext()).toThrow(/not bound/);
  });
});
