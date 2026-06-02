import { describe } from "bun:test";

import { pgTestUrl } from "./pg-test-gate.js";

/** EventBus / L2·L3 FTS 索引（Bun 用 bun:sqlite，Node 用 better-sqlite3） */
export const describeSqlite = describe;

/** 同时需要 PG 与 SQLite 的集成测试 */
export const describePgSqlite = pgTestUrl ? describe : describe.skip;
