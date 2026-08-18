import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/world-context";
import {
  runWithToolContext,
  reportToolProgress,
  resolveToolCallerSubjectId,
  setToolProgressReporter,
  clearToolProgressReporterIf,
  ToolSetRegistry,
} from "@freeanima/habitat/core/tool";

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

describe("tool progress reporter", () => {
  it("inherits onToolProgress into nested auto_llm context", () => {
    const registry = new ToolSetRegistry();
    const seen: string[] = [];
    runWithToolContext(
      "conv-progress",
      () => {
        setToolProgressReporter((content) => {
          seen.push(content);
        });
        runWithToolContext(
          "autollm-nested",
          () => {
            reportToolProgress('{"action":"run"}');
          },
          { tools: registry, contextKind: "auto_llm", subjectId: 1 },
        );
      },
      { tools: registry },
    );
    expect(seen).toEqual(['{"action":"run"}']);
  });

  it("nested setToolProgressReporter(undefined) does not clear parent sink", () => {
    const registry = new ToolSetRegistry();
    const seen: string[] = [];
    runWithToolContext(
      "conv-progress",
      () => {
        setToolProgressReporter((content) => {
          seen.push(content);
        });
        runWithToolContext(
          "autollm-nested",
          () => {
            setToolProgressReporter(undefined);
          },
          { tools: registry, contextKind: "auto_llm", subjectId: 1 },
        );
        reportToolProgress("after-child");
      },
      { tools: registry },
    );
    expect(seen).toEqual(["after-child"]);
  });

  it("clearToolProgressReporterIf only clears the matching reporter", () => {
    const registry = new ToolSetRegistry();
    const seen: string[] = [];
    const parent = (content: string): void => {
      seen.push(content);
    };
    runWithToolContext(
      "conv-progress",
      () => {
        setToolProgressReporter(parent);
        runWithToolContext(
          "autollm-nested",
          () => {
            const child = (_content: string): void => {
              seen.push("child");
            };
            setToolProgressReporter(child);
            clearToolProgressReporterIf(child);
            reportToolProgress("should-be-noop");
          },
          { tools: registry, contextKind: "auto_llm", subjectId: 1 },
        );
        reportToolProgress("parent-still");
      },
      { tools: registry },
    );
    expect(seen).toEqual(["parent-still"]);
  });
});
