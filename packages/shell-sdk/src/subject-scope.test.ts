import { describe, expect, it } from "bun:test";

import { resolveSubjectId, resolveWorldIdForSubject } from "./subject-scope.ts";
import type { ResolvedWorldContext } from "./world-context.ts";

const sample: ResolvedWorldContext = {
  user_subject_id: 1,
  agent_subject_id: 2,
  user_world_id: 10,
  agent_world_id: 20,
};

describe("resolveWorldIdForSubject", () => {
  it("maps user and agent to world ids", () => {
    expect(resolveWorldIdForSubject(sample, "user")).toBe(10);
    expect(resolveWorldIdForSubject(sample, "agent")).toBe(20);
  });
});

describe("resolveSubjectId", () => {
  it("maps user and agent to subject ids", () => {
    expect(resolveSubjectId(sample, "user")).toBe(1);
    expect(resolveSubjectId(sample, "agent")).toBe(2);
  });
});
