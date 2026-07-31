import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/host/core/config/world-context";
import {
  runWithToolContext,
  resolveToolCallerSubjectId,
  ToolSetRegistry,
} from "@freeanima/host/core/tool";

describe("resolveToolCallerSubjectId", () => {
  beforeEach(() => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
  });

  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("uses agent_subject_id when no callerAuth", () => {
    const registry = new ToolSetRegistry();
    runWithToolContext(
      "conv-1",
      () => {
        expect(resolveToolCallerSubjectId()).toBe(2);
      },
      { tools: registry },
    );
  });

  it("uses token subject_id when callerAuth present", () => {
    const registry = new ToolSetRegistry();
    runWithToolContext(
      "mcp:1",
      () => {
        expect(resolveToolCallerSubjectId()).toBe(53);
      },
      {
        tools: registry,
        contextKind: "auto_llm",
        callerAuth: {
          token_id: 1,
          subject_id: 53,
          subject_type: "user",
          scopes: ["full"],
        },
      },
    );
  });

  it("uses ALS subjectId when set without callerAuth", () => {
    const registry = new ToolSetRegistry();
    runWithToolContext(
      "autollm-1",
      () => {
        expect(resolveToolCallerSubjectId()).toBe(99);
      },
      {
        tools: registry,
        contextKind: "auto_llm",
        subjectId: 99,
      },
    );
  });

  it("prefers callerAuth over ALS subjectId", () => {
    const registry = new ToolSetRegistry();
    runWithToolContext(
      "mcp:2",
      () => {
        expect(resolveToolCallerSubjectId()).toBe(53);
      },
      {
        tools: registry,
        contextKind: "auto_llm",
        subjectId: 99,
        callerAuth: {
          token_id: 1,
          subject_id: 53,
          subject_type: "user",
          scopes: ["full"],
        },
      },
    );
  });
});
