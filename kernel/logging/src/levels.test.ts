import { describe, expect, it } from "bun:test";
import { shouldLog } from "./levels.js";
import type { LogLevel } from "./types.js";

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

describe("shouldLog", () => {
  it.each([
    ["debug", { debug: true, info: true, warn: true, error: true }],
    ["info", { debug: false, info: true, warn: true, error: true }],
    ["warn", { debug: false, info: false, warn: true, error: true }],
    ["error", { debug: false, info: false, warn: false, error: true }],
  ] as const)("configured=%s 时各级别通过性", (configured, expected) => {
    for (const level of LEVELS) {
      expect(shouldLog(configured, level)).toBe(expected[level]);
    }
  });
});
