import { afterEach, describe, expect, it } from "bun:test";

import { resolveWorldSubjectIds } from "./worlds.ts";
import {
  bindResolvedWorldContext,
  getResolvedWorldContext,
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

describe("ResolvedWorldContext", () => {
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("binds and reads five ids", () => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
    expect(getResolvedWorldContext()).toEqual({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
  });

  it("throws when unbound", () => {
    expect(() => getResolvedWorldContext()).toThrow(/not bound/);
  });

  it("resolveSubjectWorldId maps user and agent", () => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
    expect(resolveSubjectWorldId("user")).toBe(10);
    expect(resolveSubjectWorldId("agent")).toBe(20);
  });
});
