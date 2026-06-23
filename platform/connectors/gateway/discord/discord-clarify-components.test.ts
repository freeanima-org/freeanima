import { describe, expect, it } from "bun:test";

import {
  buildClarifyActionRows,
  canRenderClarifyButtons,
  cancelButtonCustomId,
  choiceButtonCustomId,
  parseClarifyButtonCustomId,
} from "./discord-clarify-components.ts";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("discord-clarify-components", () => {
  it("canRenderClarifyButtons only for single item with choices", () => {
    expect(
      canRenderClarifyButtons({
        items: [{ question: "Pick?", choices: ["A", "B"] }],
        timeout_sec: 1800,
      }),
    ).toBe(true);
    expect(
      canRenderClarifyButtons({
        items: [{ question: "Type?" }],
        timeout_sec: 1800,
      }),
    ).toBe(false);
    expect(
      canRenderClarifyButtons({
        items: [{ question: "Q1", choices: ["A"] }, { question: "Q2" }],
        timeout_sec: 1800,
      }),
    ).toBe(false);
  });

  it("buildClarifyActionRows adds choice and cancel buttons", () => {
    const rows = buildClarifyActionRows(SESSION_ID, {
      question: "Pick one?",
      choices: ["Alpha", "Beta"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.components).toHaveLength(3);
    const json = rows[0]!.toJSON();
    expect(json.components).toHaveLength(3);
    const buttons = json.components as Array<{ custom_id?: string; label?: string }>;
    const ids = buttons.map((c) => c.custom_id);
    expect(ids).toEqual([
      choiceButtonCustomId(SESSION_ID, 0),
      choiceButtonCustomId(SESSION_ID, 1),
      cancelButtonCustomId(SESSION_ID),
    ]);
  });

  it("truncates long button labels to 80 chars", () => {
    const long = "x".repeat(100);
    const rows = buildClarifyActionRows(SESSION_ID, {
      question: "Q",
      choices: [long],
    });
    const label = (rows[0]!.toJSON().components[0] as { label?: string }).label ?? "";
    expect(label.length).toBeLessThanOrEqual(80);
    expect(label.endsWith("…")).toBe(true);
  });

  it("parseClarifyButtonCustomId round-trips choice and cancel", () => {
    expect(parseClarifyButtonCustomId(choiceButtonCustomId(SESSION_ID, 2))).toEqual({
      sessionId: SESSION_ID,
      kind: "choice",
      choiceIndex: 2,
    });
    expect(parseClarifyButtonCustomId(cancelButtonCustomId(SESSION_ID))).toEqual({
      sessionId: SESSION_ID,
      kind: "cancel",
    });
    expect(parseClarifyButtonCustomId("other:prefix")).toBeNull();
  });
});
