import { customType } from "drizzle-orm/pg-core";

import { normalizePgTimestamp } from "../jsonb/timestamp.ts";

/** PostgreSQL `timestamptz` — read/write as `Date` in application code. */
export const pgTimestamptz = customType<{ data: Date; driverData: string }>({
  dataType() {
    return "timestamp with time zone";
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? new Date(0) : value;
    }
    if (value == null || value === "") return new Date(0);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  },
  toDriver(value: Date): string {
    return normalizePgTimestamp(value);
  },
});
