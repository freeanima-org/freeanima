import type { SapInstanceRow } from "@freeanima/core/db/schema/rows";

export type { SapInstanceRow };

export type SapInstanceUpsertInput = {
  instance_id: string;
  app_id: string;
  http_url?: string | null;
  created_at?: Date;
};
