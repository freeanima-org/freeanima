import "@freeanima/legacy-runtime/system-prompt-wire";
import { describe } from "bun:test";

/**
 * PG 集成测试门控。
 *
 * `bun test:integration` 经 preload 注入 `ANIMA_TEST_PG_URL`（Testcontainers）。
 * 未设置 URL 时 skip（如 `bun test` 单元测试路径）。
 */
export const pgTestUrl = process.env.ANIMA_TEST_PG_URL;
export const describePg = pgTestUrl ? describe : describe.skip;
