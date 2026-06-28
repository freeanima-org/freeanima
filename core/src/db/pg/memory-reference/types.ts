/** Single memory reference record */
export type MemoryReferenceRow = {
  id: string;
  message_id: string;
  semantic_memory_id: string;
  conversation_id: string;
  created_at: string;
};

export type RecordMessageReferencesInput = {
  message_id: string;
  conversation_id: string;
  content: string;
  created_at?: string;
  /** cron platform conversation：跳过引用计数与 memory_references 写入 */
  skip_reference_count?: boolean;
};
