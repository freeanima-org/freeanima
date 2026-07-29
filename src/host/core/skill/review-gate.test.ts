import { describe, expect, it } from "bun:test";
import type { StoredMessage } from "@freeanima/host/core/db/domain";
import { SkillRegistry, skillDefFromBody } from "./registry.ts";
import { skillBodySchema } from "@freeanima/host/core/db/schema/entity";
import {
  buildSkillReviewSystemPrompt,
  buildSkillReviewUserPrompt,
  collectTurnToolStats,
  evaluateSkillEvolveGate,
} from "./review-gate.ts";

function msgs(list: StoredMessage[]): StoredMessage[] {
  return list;
}

describe("skill evolve gate", () => {
  it("skips when below min tool calls", () => {
    const gate = evaluateSkillEvolveGate(
      msgs([
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "1", function: { name: "memory_recall", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "1", name: "memory_recall", content: '{"ok":true}' },
        { role: "assistant", content: "done" },
      ]),
      { minToolCalls: 5 },
    );
    expect(gate.run).toBe(false);
  });

  it("runs when tool calls meet threshold", () => {
    const toolCalls = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      function: { name: `t${i}`, arguments: "{}" },
    }));
    const turn: StoredMessage[] = [
      { role: "user", content: "do stuff" },
      { role: "assistant", content: null, tool_calls: toolCalls },
      ...toolCalls.map(
        (tc): StoredMessage => ({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: "ok",
        }),
      ),
      { role: "assistant", content: "done" },
    ];
    const gate = evaluateSkillEvolveGate(turn, { minToolCalls: 5 });
    expect(gate.run).toBe(true);
    expect(gate.stats.toolCallCount).toBe(5);
  });

  it("skips when skill already written this turn", () => {
    const gate = evaluateSkillEvolveGate(
      msgs([
        { role: "user", content: "save" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "1",
              function: {
                name: "skill_create",
                arguments: '{"name":"x","description":"d","content":"c"}',
              },
            },
          ],
        },
        { role: "tool", tool_call_id: "1", name: "skill_create", content: '{"ok":true}' },
      ]),
      { force: false, minToolCalls: 1 },
    );
    expect(gate.run).toBe(false);
    expect(gate.reason).toContain("already written");
  });

  it("force overrides write skip", () => {
    const gate = evaluateSkillEvolveGate(
      msgs([
        { role: "user", content: "x" },
        { role: "assistant", content: "y" },
      ]),
      { force: true },
    );
    expect(gate.run).toBe(true);
  });

  it("runs on skill_load with tool error", () => {
    const gate = evaluateSkillEvolveGate(
      msgs([
        { role: "user", content: "use skill" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "1", function: { name: "skill_load", arguments: '{"name":"research"}' } },
            { id: "2", function: { name: "web_search", arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "1", name: "skill_load", content: '{"skill":"research"}' },
        {
          role: "tool",
          tool_call_id: "2",
          name: "web_search",
          content: '{"error":"rate limited"}',
        },
      ]),
    );
    expect(gate.run).toBe(true);
    expect(gate.reason).toContain("skill_load");
  });

  it("collectTurnToolStats tracks recovery after error", () => {
    const stats = collectTurnToolStats(
      msgs([
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "1", function: { name: "a", arguments: "{}" } },
            { id: "2", function: { name: "a", arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "1", name: "a", content: '{"error":"fail"}' },
        { role: "tool", tool_call_id: "2", name: "a", content: "ok" },
      ]),
    );
    expect(stats.hadToolError).toBe(true);
    expect(stats.hadSuccessAfterError).toBe(true);
  });
});

describe("skill review prompts", () => {
  it("injects curation body and catalog", () => {
    const skills = new SkillRegistry();
    skills.register(
      skillDefFromBody(
        {
          name: "demo",
          description: "demo skill",
          entityId: 1,
          worldId: 10,
          content: "body",
        },
        skillBodySchema.parse({ origin: "user", status: "active" }),
      ),
    );
    const sys = buildSkillReviewSystemPrompt("evolve", "CURATION RULES");
    expect(sys).toContain("mode=evolve");
    expect(sys).toContain("CURATION RULES");
    const user = buildSkillReviewUserPrompt({ mode: "maintain", skills });
    expect(user).toContain("demo: demo skill");
    expect(user).toContain("Maintain task");
  });
});
