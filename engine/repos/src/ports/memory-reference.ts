/** 单条记忆引用记录 */
export type MemoryReferenceRow = {
  id: string;
  message_id: string;
  semantic_memory_id: string;
  session_id: string;
  created_at: string;
};

export type RecordMessageReferencesInput = {
  message_id: string;
  session_id: string;
  content: string;
  created_at?: string;
};

/** 消息 `[记忆 #xxx]` 引用持久化与计数同步 */
export interface MemoryReferenceStorePort {
  /** 解析正文并写入引用；同 session 内重复引用不增量更新 reference_count */
  recordFromMessage(input: RecordMessageReferencesInput): Promise<string[]>;
  /** 从 memory_references 全量重算 semantic_memory.reference_count */
  syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }>;
  countBySemanticMemory(semanticMemoryId: string): Promise<number>;
}
