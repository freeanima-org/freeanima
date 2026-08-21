import { afterEach, describe, expect, test } from "bun:test";

import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/resolved-world-context.ts";

import { resolveContactWorldId } from "./contact-world.ts";

describe("resolveContactWorldId", () => {
  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  test("从 ResolvedWorldContext 读取 commons_world_id", () => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      default_chat_agent_subject_id: 2,
      default_chat_agent_world_id: 20,
      commons_world_id: 30,
    });
    expect(resolveContactWorldId()).toBe(30);
  });
});
