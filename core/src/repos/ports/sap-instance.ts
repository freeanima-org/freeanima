/** Hub 分配的 SAP 卫星 instance（3 字符 id） */
export type SapInstanceRow = {
  instanceId: string;
  appId: string;
  httpUrl: string | null;
  createdAt: string;
};

export type SapInstanceUpsertInput = {
  instanceId: string;
  appId: string;
  httpUrl?: string | null;
  createdAt?: string;
};

export interface SapInstanceStorePort {
  get(instanceId: string): Promise<SapInstanceRow | null>;
  upsert(row: SapInstanceUpsertInput): Promise<void>;
  listAll(): Promise<SapInstanceRow[]>;
}
