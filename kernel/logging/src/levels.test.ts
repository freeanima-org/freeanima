import { describe, expect, it } from "bun:test";
import { shouldLog } from "./levels.ts";
import type { LogLevel } from "./types.ts";

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

describe("shouldLog", () => {
  it.each([
    ["debug", { debug: true, info: true, warn: true, error: true }],
    ["info", { debug: false, info: true, warn: true, error: true }],
    ["warn", { debug: false, info: false, warn: true, error: true }],
    ["error", { debug: false, info: false, warn: false, error: true }],
  ] as const)("level passability when configured=%s", (configured, expected) => {
    for (const level of LEVELS) {
      expect(shouldLog(configured, level)).toBe(expected[level]);
    }
  });
});
