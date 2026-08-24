import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { messages } from "@freeanima/habitat/core/db/schema";

/**
 * PG `message_payload_timestamp(payload)`（IMMUTABLE；与 idx_messages_payload_timestamp 对齐）。
 * 热路径 range / 聚合必须用此表达式，勿再手写 nullif(btrim(...))::timestamptz。
 */
export function messagePayloadTimestampSql(payloadCol: PgColumn = messages.payload) {
  return sql`message_payload_timestamp(${payloadCol})`;
}
