import { describe } from "vitest";

/**
 * PG 集成测试门控。
 *
 * `pnpm test:integration` 经 globalSetup 注入 `ANIMA_TEST_PG_URL`（Testcontainers）。
 * 未设置 URL 时 skip（如 `pnpm test` 单元测试路径）。
 */
export const pgTestUrl = process.env.ANIMA_TEST_PG_URL;
export const describePg = pgTestUrl ? describe : describe.skip;
