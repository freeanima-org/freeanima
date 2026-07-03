import { describe, expect, test } from "bun:test";
import { evaluateHealthAuthed } from "./health-auth.ts";
import { isHealthProbePath } from "./remote-auth.ts";

describe("health-auth", () => {
  test("isHealthProbePath", () => {
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/health"))).toBe(true);
    expect(isHealthProbePath(new Request("https://remote.example/api/health"))).toBe(true);
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
    expect(
      isHealthProbePath(new Request("http://127.0.0.1:2658/api/health", { method: "POST" })),
    ).toBe(false);
  });

  test("evaluateHealthAuthed 无 token", async () => {
    const authed = await evaluateHealthAuthed(new Request("https://remote.example/api/health"));
    expect(authed).toBe(false);
  });
});
