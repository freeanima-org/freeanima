import { describe, expect, it } from "bun:test";

import { workflowDefinitionSchema } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { validateWorkflowDefinition } from "./validate-workflow-definition.ts";

describe("validateWorkflowDefinition", () => {
  it("rejects duplicate and forward step refs", () => {
    const def = workflowDefinitionSchema.parse({
      steps: [
        {
          id: "a",
          type: "transform",
          op: { op: "get", from: { ref: "step", id: "b" }, path: ["x"] },
        },
        {
          id: "a",
          type: "llm",
          prompt: "hi",
        },
      ],
    });
    const v = validateWorkflowDefinition(def);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "duplicate_step_id")).toBe(true);
    expect(
      v.errors.some((e) => e.code === "forward_step_ref" || e.code === "unknown_step_ref"),
    ).toBe(true);
  });

  it("checks input_schema paths", () => {
    const def = workflowDefinitionSchema.parse({
      input_schema: {
        type: "object",
        properties: { week: { type: "string" } },
        required: ["week"],
      },
      steps: [
        {
          id: "t",
          type: "transform",
          op: {
            op: "get",
            from: { ref: "input", path: ["missing"] },
            path: ["x"],
          },
        },
      ],
    });
    const v = validateWorkflowDefinition(def);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "input_path_missing")).toBe(true);
  });

  it("flags tool arg type mismatch when schemas known", () => {
    const def = workflowDefinitionSchema.parse({
      steps: [
        {
          id: "fetch",
          type: "tool",
          tool: "demo_fetch",
          args: {},
        },
        {
          id: "write",
          type: "tool",
          tool: "demo_write",
          args: {
            text: { ref: "step", id: "fetch" },
          },
        },
      ],
    });
    const v = validateWorkflowDefinition(def, {
      getTool: (name) => {
        if (name === "demo_fetch") {
          return {
            parameters: { type: "object", properties: {} },
            returnSchema: {
              type: "object",
              properties: { text: { type: "string" } },
            },
          };
        }
        if (name === "demo_write") {
          return {
            parameters: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          };
        }
        return null;
      },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "arg_type_mismatch")).toBe(true);
  });

  it("accepts path into prior object output", () => {
    const def = workflowDefinitionSchema.parse({
      steps: [
        {
          id: "fetch",
          type: "tool",
          tool: "demo_fetch",
          args: {},
        },
        {
          id: "write",
          type: "tool",
          tool: "demo_write",
          args: {
            text: { ref: "step", id: "fetch", path: ["text"] },
          },
        },
      ],
    });
    const v = validateWorkflowDefinition(def, {
      getTool: (name) => {
        if (name === "demo_fetch") {
          return {
            parameters: { type: "object", properties: {} },
            returnSchema: {
              type: "object",
              properties: { text: { type: "string" } },
            },
          };
        }
        if (name === "demo_write") {
          return {
            parameters: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          };
        }
        return null;
      },
    });
    expect(v.ok).toBe(true);
  });
});
