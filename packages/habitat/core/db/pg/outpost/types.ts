import type { OutpostInstanceRow } from "@freeanima/habitat/core/db/schema/rows";

export type { OutpostInstanceRow };

export type OutpostInstanceUpsertInput = {
  instance_id: string;
  app_id: string;
  http_url?: string | null;
  created_at?: Date;
};
