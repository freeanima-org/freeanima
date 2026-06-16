import { describe, expect, test } from "bun:test";
import { executePetTool } from "./executor.ts";

describe("executePetTool", () => {
  test("pet_say returns json string", async () => {
    const result = await executePetTool("pet_say", { text: "你好" });
    expect(JSON.parse(result)).toEqual({ ok: true, text: "你好" });
  });

  test("pet_emote returns json string", async () => {
    const result = await executePetTool("pet_emote", { emotion: "joy", weight: 0.8 });
    expect(JSON.parse(result)).toEqual({ ok: true, emotion: "joy" });
  });

  test("pet_move returns json string", async () => {
    const result = await executePetTool("pet_move", { x: 100, y: 200 });
    expect(JSON.parse(result)).toEqual({ ok: true, x: 100, y: 200 });
  });

  test("unknown tool throws", async () => {
    await expect(executePetTool("unknown", {})).rejects.toThrow("unknown pet tool");
  });
});
