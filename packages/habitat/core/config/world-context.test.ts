import { afterEach, describe, expect, it } from "bun:test";

import { resolveWorldSubjectIds } from "./worlds.ts";
import {
  bindResolvedWorldContext,
  getResolvedWorldContext,
  tryGetResolvedWorldContext,
  resetResolvedWorldContextForTest,
  resolveSubjectWorldId,
} from "./resolved-world-context.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

describe("resolveWorldSubjectIds", () => {
  it("returns empty when unset", () => {
    const config = {
      connections: {},
    } as RuntimeConfig;
    expect(resolveWorldSubjectIds(config)).toEqual({});
  });

  it("prefers worlds section over notifications", () => {
    const config = {
      connections: {},
      worlds: { user_subject_id: 5, agent_subject_id: 6 },
      notifications: { user_subject_id: 1, agent_subject_id: 2 },
    } as RuntimeConfig;
    expect(resolveWorldSubjectIds(config)).toEqual({
      user_subject_id: 5,
      agent_subject_id: 6,
    });
  });

  it("allows partial worlds override", () => {
    const config = {
      connections: {},
      worlds: { user_subject_id: 5 },
    } as RuntimeConfig;
    expect(resolveWorldSubjectIds(config)).toEqual({
      user_subject_id: 5,
    });
  });
});

function sampleCtx() {
  return {
    user_subject_id: 1,
    user_world_id: 10,
    commons_world_id: 30,
    default_chat_agent_subject_id: 2,
    default_chat_agent_world_id: 20,
    agent_subject_id: 2,
    agent_world_id: 20,
  };
}

describe("ResolvedWorldContext", () => {
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("binds and reads ids", () => {
    bindResolvedWorldContext(sampleCtx());
    expect(getResolvedWorldContext()).toEqual(sampleCtx());
  });

  it("throws when unbound", () => {
    expect(() => getResolvedWorldContext()).toThrow(/not bound/);
  });

  it("tryGet returns null when unbound", () => {
    expect(tryGetResolvedWorldContext()).toBeNull();
    bindResolvedWorldContext(sampleCtx());
    expect(tryGetResolvedWorldContext()?.default_chat_agent_subject_id).toBe(2);
  });

  it("resolveSubjectWorldId maps user only; agent throws", () => {
    bindResolvedWorldContext(sampleCtx());
    expect(resolveSubjectWorldId("user")).toBe(10);
    expect(() => resolveSubjectWorldId("agent")).toThrow(/removed/);
  });
});
