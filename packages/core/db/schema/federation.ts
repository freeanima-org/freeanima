import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { entities } from "./entity/entity.ts";

export type TrustedSatelliteStatus = "pending" | "trusted" | "revoked";

/** Hub 侧授信 Satellite 目录（1 Hub = 1 联邦） */
export const habitatTrustedSatellites = pgTable(
  "habitat_trusted_satellites",
  {
    satellite_habitat_instance_id: text("satellite_habitat_instance_id").primaryKey(),
    satellite_public_key: text("satellite_public_key").notNull(),
    label: text("label"),
    status: text("status").$type<TrustedSatelliteStatus>().notNull().default("pending"),
    linked_contact_id: bigint("linked_contact_id", { mode: "number" }).references(
      () => entities.id,
      { onDelete: "set null" },
    ),
    created_at: pgTimestamptz("created_at").notNull(),
    /** pending 时为 null；授信通过时写入 */
    trusted_at: pgTimestamptz("trusted_at"),
    revoked_at: pgTimestamptz("revoked_at"),
  },
  (t) => [index("idx_habitat_trusted_satellites_status").on(t.status)],
);
