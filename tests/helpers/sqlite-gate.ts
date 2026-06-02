import { describe } from "bun:test";

import { pgTestUrl } from "./pg-test-gate.js";

/** better-sqlite3 尚不支持 Bun；EventBus / L2·L3 FTS 索引相关集成测试在 Bun 下跳过 */
export const describeSqlite = describe.skipIf(typeof Bun !== "undefined");

/** 同时需要 PG 与 better-sqlite3（仅 Node 集成跑全量） */
export const describePgSqlite = pgTestUrl && typeof Bun === "undefined" ? describe : describe.skip;
