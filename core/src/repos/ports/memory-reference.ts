/** Single memory reference record */
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

/** Persist `[[f-xxx]]` references in message body and sync counts */
export interface MemoryReferenceStorePort {
  /** Parse body and write references; duplicate refs in same session do not increment reference_count */
  recordFromMessage(input: RecordMessageReferencesInput): Promise<string[]>;
  /** Full recompute semantic_memory.reference_count from memory_references */
  syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }>;
  countBySemanticMemory(semanticMemoryId: string): Promise<number>;
}
