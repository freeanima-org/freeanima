import { describe, expect, it } from "bun:test";

import type { ValueRef } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { resolveValueRef, digPath, ValueRefResolveError } from "./value-ref.ts";
import { runTransformOp } from "./transform.ts";
import type { WorkflowVarRoot } from "./types.ts";

const root: WorkflowVarRoot = {
  input: { week: "2026-W34", tags: ["a", "b"] },
  prev: { text: "hello" },
  step: {
    fetch: {
      output: {
        items: [
          { id: 1, tags: ["work"] },
          { id: 2, tags: ["home"] },
        ],
      },
    },
    summary: { output: "done this week" },
  },
  last_run: { id: "wf_prev", output: { text: "last week summary" } },
};

describe("resolveValueRef", () => {
  it("resolves literal / input / prev / step / last_run", () => {
    expect(resolveValueRef({ ref: "literal", value: 3 }, root)).toBe(3);
    expect(resolveValueRef({ ref: "input", path: ["week"] }, root)).toBe("2026-W34");
    expect(resolveValueRef({ ref: "prev", path: ["text"] }, root)).toBe("hello");
    expect(resolveValueRef({ ref: "step", id: "summary" }, root)).toBe("done this week");
    expect(resolveValueRef({ ref: "last_run" }, root)).toEqual({ text: "last week summary" });
    expect(resolveValueRef({ ref: "last_run", path: ["output", "text"] }, root)).toBe(
      "last week summary",
    );
  });

  it("builds object and array", () => {
    const ref: ValueRef = {
      ref: "object",
      fields: {
        a: { ref: "input", path: ["week"] },
        b: { ref: "literal", value: true },
      },
    };
    expect(resolveValueRef(ref, root)).toEqual({ a: "2026-W34", b: true });
    expect(
      resolveValueRef(
        {
          ref: "array",
          items: [
            { ref: "literal", value: 1 },
            { ref: "input", path: ["week"] },
          ],
        },
        root,
      ),
    ).toEqual([1, "2026-W34"]);
  });

  it("throws on missing path", () => {
    expect(() => digPath({ a: 1 }, ["b"])).toThrow(ValueRefResolveError);
  });
});

describe("runTransformOp", () => {
  it("filter_includes on nested tags", () => {
    const out = runTransformOp(
      {
        op: "filter_includes",
        from: { ref: "step", id: "fetch", path: ["items"] },
        path: ["tags"],
        value: "work",
      },
      root,
    );
    expect(out).toEqual([{ id: 1, tags: ["work"] }]);
  });

  it("pick / get / template_object", () => {
    expect(runTransformOp({ op: "pick", from: { ref: "input" }, keys: ["week"] }, root)).toEqual({
      week: "2026-W34",
    });
    expect(runTransformOp({ op: "get", from: { ref: "prev" }, path: ["text"] }, root)).toBe(
      "hello",
    );
    expect(
      runTransformOp(
        {
          op: "template_object",
          fields: {
            this_week: { ref: "step", id: "summary" },
            last_week: { ref: "last_run" },
          },
        },
        root,
      ),
    ).toEqual({
      this_week: "done this week",
      last_week: { text: "last week summary" },
    });
  });
});
