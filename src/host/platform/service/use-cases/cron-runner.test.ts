import { describe, expect, it } from "bun:test";
import { toolNamesForInvisiblePolicy } from "./cron-runner.ts";
import type { ResolvedCapabilityPolicy } from "@freeanima/host/core/capability-policy";

const pool = ["memory_recall", "file_read", "browser_navigate", "notification_send"];

function policy(allowed: string[], denied: string[] = []): ResolvedCapabilityPolicy {
  return { allowed_tools: allowed, denied_tools: denied };
}

describe("toolNamesForInvisiblePolicy", () => {
  it("returns empty when policy has no allows (default deny)", () => {
    expect(toolNamesForInvisiblePolicy(pool, policy([]))).toEqual([]);
  });

  it("intersects pool with allowed tools", () => {
    expect(toolNamesForInvisiblePolicy(pool, policy(["memory_recall", "file_read"]))).toEqual([
      "memory_recall",
      "file_read",
    ]);
  });

  it("drops allows that are not in the pool", () => {
    expect(toolNamesForInvisiblePolicy(pool, policy(["memory_recall", "unknown_tool"]))).toEqual([
      "memory_recall",
    ]);
  });
});
