import { describe } from "bun:test";

import { pgTestUrl } from "./pg-test-gate.ts";

/** EventBus / 语义·情景记忆 FTS（bun:sqlite） */
export const describeSqlite = describe;

/** 同时需要 PG 与 SQLite 的集成测试 */
export const describePgSqlite = pgTestUrl ? describe : describe.skip;
