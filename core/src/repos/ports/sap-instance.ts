import type { SapInstanceRow } from "@freeanima/core/db/schema/rows";

export type { SapInstanceRow };

export type SapInstanceUpsertInput = {
  instance_id: string;
  app_id: string;
  http_url?: string | null;
  created_at?: Date;
};

export interface SapInstanceStorePort {
  get(instance_id: string): Promise<SapInstanceRow | null>;
  upsert(row: SapInstanceUpsertInput): Promise<void>;
  listAll(): Promise<SapInstanceRow[]>;
}
