import { customType } from "drizzle-orm/pg-core";

/** Shared Drizzle column type for PostgreSQL `tsvector` (FTS). */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});
