import { bigint, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { ServiceApiTokenAuthorization } from "@freeanima/shared/service-api-auth";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { entities } from "./entity/entity.ts";

const DEFAULT_FULL_AUTHORIZATION = { full: true } as const satisfies ServiceApiTokenAuthorization;

/** Habitat Service API tokens — bound to subject (user/agent) entity id */
export const serviceApiTokens = pgTable(
  "service_api_tokens",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    subject_id: bigint("subject_id", { mode: "number" })
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    token_hash: text("token_hash").notNull(),
    /** 可恢复 secret；旧行可为 null（无法再次 reveal） */
    token_secret: text("token_secret"),
    /** 结构化授权；存量迁移为 { full: true } */
    authorization: jsonb("authorization")
      .$type<ServiceApiTokenAuthorization>()
      .notNull()
      .default(DEFAULT_FULL_AUTHORIZATION),
    created_at: pgTimestamptz("created_at").notNull(),
    expires_at: pgTimestamptz("expires_at"),
    last_used_at: pgTimestamptz("last_used_at"),
    revoked_at: pgTimestamptz("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_service_api_tokens_prefix").on(table.prefix),
    index("idx_service_api_tokens_subject_id").on(table.subject_id),
  ],
);
