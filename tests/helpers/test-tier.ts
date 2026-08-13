/**
 * 同文件混标（过渡用）。bun:test 无原生 tags。
 * `FREEANIMA_TEST_TIER=core` 时 enhanced 用例 skip。
 */
import { describe, test } from "bun:test";

export type TestTier = "core" | "enhanced" | "all";

export function resolveTestTier(): TestTier {
  const raw = process.env.FREEANIMA_TEST_TIER?.trim().toLowerCase();
  if (raw === "core" || raw === "enhanced" || raw === "all") return raw;
  return "all";
}

const skipEnhanced = resolveTestTier() === "core";

/** 始终跑（core 门禁与全量均包含） */
export const describeCore = describe;
export const testCore = test;

/** 仅全量；`FREEANIMA_TEST_TIER=core` 时 skip */
export const describeEnhanced: typeof describe = skipEnhanced
  ? Object.assign((name: string, fn: () => void) => describe.skip(name, fn), describe)
  : describe;

export const testEnhanced: typeof test = skipEnhanced
  ? Object.assign(
      (name: string, fn: () => void | Promise<void>, timeout?: number) =>
        test.skip(name, fn, timeout),
      test,
    )
  : test;
