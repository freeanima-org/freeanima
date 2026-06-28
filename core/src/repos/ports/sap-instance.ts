/** Hub 分配的 SAP 卫星 instance（3 字符 id） */
export type SapInstanceRow = {
  instance_id: string;
  app_id: string;
  http_url: string | null;
  created_at: string;
};

export type SapInstanceUpsertInput = {
  instance_id: string;
  app_id: string;
  http_url?: string | null;
  created_at?: string;
};

export interface SapInstanceStorePort {
  get(instance_id: string): Promise<SapInstanceRow | null>;
  upsert(row: SapInstanceUpsertInput): Promise<void>;
  listAll(): Promise<SapInstanceRow[]>;
}
