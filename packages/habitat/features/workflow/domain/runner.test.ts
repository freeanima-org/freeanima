import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import { minimalChatRuntime } from "@freeanima/habitat/core/config/test-helpers/minimal-llm-config.ts";
import type { WorkflowStep } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import type { WorkflowRunnerDeps } from "./runner.ts";

const runs = new Map<
  string,
  {
    id: string;
    workflow_entity_id: number | null;
    name: string | null;
    input: unknown;
    output: unknown;
    status: string;
    error: string | null;
    world_id: number | null;
  }
>();

const workflowRunOriginal = await import("@freeanima/habitat/core/db/pg/workflow-run");

mock.module("@freeanima/habitat/core/db/pg/workflow-run", () => ({
  ...workflowRunOriginal,
  generateWorkflowRunId: () => `wf_test_${runs.size + 1}`,
  insertRunningWorkflowRun: async (input: {
    id?: string;
    workflow_entity_id?: number | null;
    name?: string | null;
    input: unknown;
    world_id?: number | null;
  }) => {
    const id = input.id ?? `wf_test_${runs.size + 1}`;
    const row = {
      id,
      workflow_entity_id: input.workflow_entity_id ?? null,
      name: input.name ?? null,
      input: input.input,
      output: null as unknown,
      status: "running",
      error: null as string | null,
      subject_id: null,
      world_id: input.world_id ?? null,
      created_at: new Date().toISOString(),
      finished_at: null,
    };
    runs.set(id, row);
    return row;
  },
  finishWorkflowRun: async (input: {
    id: string;
    status: "completed" | "failed";
    output?: unknown;
    error?: string | null;
  }) => {
    const row = runs.get(input.id);
    if (!row) throw new Error("missing run");
    row.status = input.status;
    row.output = input.output ?? null;
    row.error = input.error ?? null;
    return {
      ...row,
      created_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      subject_id: null,
    };
  },
  getLatestSuccessfulWorkflowRun: async (opts: { workflow_entity_id?: number; name?: string }) => {
    const list = [...runs.values()]
      .filter((r) => r.status === "completed")
      .filter((r) =>
        opts.workflow_entity_id != null
          ? r.workflow_entity_id === opts.workflow_entity_id
          : r.name === opts.name,
      );
    const hit = list.at(-1);
    return hit
      ? {
          ...hit,
          created_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          subject_id: null,
        }
      : null;
  },
  getWorkflowRun: async () => null,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/workflow-run", () => workflowRunOriginal);
});

const { runWorkflow } = await import("./runner.ts");

function makeRegistry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.registerToolSet("demo", "demo", [
    {
      name: "demo_echo",
      description: "echo",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
      handler: async (args) => JSON.stringify({ echoed: args.text }),
    },
  ]);
  return reg;
}

function baseDeps(over: Partial<WorkflowRunnerDeps> = {}): WorkflowRunnerDeps {
  return {
    toolSets: makeRegistry(),
    config: runtimeConfigSchema.parse(minimalChatRuntime({ model: "m" })),
    runAutoLlm: async () => {
      throw new Error("llm should not run");
    },
    runtimeDeps: null as unknown as WorkflowRunnerDeps["runtimeDeps"],
    loadNamedWorkflow: async () => null,
    ...over,
  };
}

describe("runWorkflow", () => {
  beforeEach(() => {
    runs.clear();
  });

  it("runs ephemeral tool + transform sequentially", async () => {
    const steps: WorkflowStep[] = [
      {
        id: "echo",
        type: "tool",
        tool: "demo_echo",
        args: {
          text: { ref: "input", path: ["msg"] },
        },
      },
      {
        id: "pick",
        type: "transform",
        op: {
          op: "get",
          from: { ref: "prev" },
          path: ["echoed"],
        },
      },
    ];
    const result = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        steps,
        input: { msg: "hi" },
        debug: true,
      },
      baseDeps(),
    );
    expect(result.status).toBe("completed");
    expect(result.output).toBe("hi");
    expect(result.steps?.map((s) => s.id)).toEqual(["echo", "pick"]);
  });

  it("llm step calls runAutoLlm with workflow_llm", async () => {
    const calls: unknown[] = [];
    const steps: WorkflowStep[] = [
      {
        id: "sum",
        type: "llm",
        prompt: "summarize",
        scenario: "chat",
      },
    ];
    const result = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        name: "weekly",
        workflowEntityId: 99,
        steps,
        input: {},
      },
      baseDeps({
        runAutoLlm: async (_deps, input) => {
          calls.push(input);
          return {
            runId: "autollm_1",
            output: "summary text",
            toolCalls: 0,
            status: "ok",
            durationMs: 1,
            steps: [],
          };
        },
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.output).toBe("summary text");
    expect(calls).toHaveLength(1);
    const call = calls[0] as { runKind: string; toolNames: string[]; model: string };
    expect(call.runKind).toBe("workflow_llm");
    expect(call.toolNames).toEqual([]);
    expect(call.model).toBe("m");
  });

  it("failed run does not count as last_run for next named run", async () => {
    const deps = baseDeps();
    const fail = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        name: "named-wf",
        workflowEntityId: 7,
        steps: [
          {
            id: "bad",
            type: "tool",
            tool: "missing_tool",
            args: {},
          },
        ],
        input: {},
      },
      deps,
    );
    expect(fail.status).toBe("failed");

    const ok = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        name: "named-wf",
        workflowEntityId: 7,
        steps: [
          {
            id: "echo",
            type: "tool",
            tool: "demo_echo",
            args: { text: { ref: "literal", value: "x" } },
          },
        ],
        input: {},
        debug: true,
      },
      deps,
    );
    expect(ok.status).toBe("completed");
    expect(ok.output).toEqual({ echoed: "x" });

    const third = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        name: "named-wf",
        workflowEntityId: 7,
        steps: [
          {
            id: "t",
            type: "transform",
            op: {
              op: "template_object",
              fields: {
                prev_out: { ref: "last_run" },
              },
            },
          },
        ],
        input: {},
      },
      deps,
    );
    expect(third.status).toBe("completed");
    expect(third.output).toEqual({ prev_out: { echoed: "x" } });
  });

  it("nested child does not update child last_run visibility for sibling", async () => {
    const childSteps: WorkflowStep[] = [
      {
        id: "c1",
        type: "transform",
        op: { op: "template_object", fields: { v: { ref: "literal", value: 1 } } },
      },
    ];
    const result = await runWorkflow(
      {
        worldId: 1,
        subjectId: 2,
        name: "parent",
        workflowEntityId: 10,
        steps: [
          {
            id: "child",
            type: "workflow",
            name: "child-wf",
            input: { ref: "input" },
          },
        ],
        input: {},
      },
      baseDeps({
        loadNamedWorkflow: async (_w, name) => {
          if (name !== "child-wf") return null;
          return {
            id: 11,
            world_id: 1,
            name: "child-wf",
            title: "child-wf",
            summary: "",
            content: "",
            steps: childSteps,
            origin: "user",
            status: "active",
            allowed_tools: [],
            denied_tools: [],
            created_at: "",
            updated_at: "",
          };
        },
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ v: 1 });
    const nestedNamed = [...runs.values()].filter((r) => r.name === "child-wf");
    expect(nestedNamed).toHaveLength(0);
  });
});
