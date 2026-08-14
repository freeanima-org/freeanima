/**
 * MemoryService 契约类型（风巢 #16102）。
 * embedded | remote 同形；本文件不依赖 PG row，便于日后抽到 shared / harness。
 */

export type MemoryDeployment = "embedded" | "remote";

/** 召回范围：禁止跨类型统一 RRF */
export type MemoryRecallScope = "semantic" | "temporal";

export type MemoryLinkType = "merged_from" | "supersedes" | "conflicts_with" | "derived_from";

export type MemoryProvenance = {
  conversation_id: string;
  message_id_from?: string;
  message_id_to?: string;
  message_ids?: string[];
};

export type MemoryLink = {
  type: MemoryLinkType;
  memory_id: number;
};

/** 语义记忆 kind（客观为骨架；主观用 kind 标注） */
export type MemorySemanticKind =
  | "world"
  | "observation"
  | "procedural"
  | "opinion"
  | "preference"
  | "experience";

export type MemoryRecordStatus = "active" | "deprecated";

export type MemoryRecord = {
  id: number;
  content: string;
  kind: string;
  status: MemoryRecordStatus;
  pinned: boolean;
  reference_count: number;
  source?: MemoryProvenance | null;
  links?: MemoryLink[];
  /** 兼容旧 source_conversations */
  source_conversations?: string[];
  observed_at?: Date | string | null;
  occurred_at?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  world_id?: number;
};

export type SyncTurnInput = {
  conversation_id: string;
  /** 本回合新消息 id（user/assistant 正文） */
  message_ids: string[];
  /** 可选：回合全文，供 cite 解析 */
  texts?: string[];
  /** 是否触发 retain（默认 true） */
  trigger_retain?: boolean;
};

export type SyncTurnResult = {
  cited_ids: number[];
  retain_scheduled: boolean;
};

export type RetainInput = {
  conversation_id: string;
  message_id_from?: string;
  message_id_to?: string;
  message_ids?: string[];
  /** 可重放：同一窗重复 retain 应幂等 */
  force?: boolean;
};

export type RetainResult = {
  created: number[];
  updated: number[];
  skipped: boolean;
};

export type RecallInput = {
  query: string;
  scope: MemoryRecallScope;
  limit?: number;
};

export type RecallHit = {
  id: number;
  score: number;
  scope: MemoryRecallScope;
  content: string;
  kind?: string;
};

export type RecallResult = {
  hits: RecallHit[];
};

export type MemorySearchInput = {
  query?: string;
  scope?: MemoryRecallScope;
  kinds?: string[];
  status?: MemoryRecordStatus | "all";
  limit?: number;
  offset?: number;
};

export type ReflectInput = {
  /** 巩固作业范围；缺省由实现决定 */
  conversation_ids?: string[];
  force?: boolean;
};

export type ReflectResult = {
  merged: number;
  deprecated: number;
  conflicts: number;
};

export type RememberInput = {
  content: string;
  kind?: string;
  pinned?: boolean;
  source: MemoryProvenance;
  links?: MemoryLink[];
  observed_at?: Date | string | null;
  occurred_at?: string | null;
};

export type UpdateMemoryInput = {
  id: number;
  content?: string;
  kind?: string;
  pinned?: boolean;
  status?: MemoryRecordStatus;
  source?: MemoryProvenance;
  links?: MemoryLink[];
  observed_at?: Date | string | null;
  occurred_at?: string | null;
};

export type ListMemoryInput = {
  kinds?: string[];
  status?: MemoryRecordStatus | "all";
  pinned?: boolean;
  limit?: number;
  offset?: number;
};

export type CiteInput = {
  texts: string[];
  conversation_id?: string;
};

export type CiteResult = {
  cited_ids: number[];
};

export type TemporalBucket = "day" | "month" | "year";

export type TemporalRecord = {
  id: number;
  bucket: TemporalBucket;
  /** CST 日期或年月键 */
  key: string;
  title?: string;
  summary: string;
};

export type TemporalListInput = {
  bucket?: TemporalBucket;
  limit?: number;
  offset?: number;
};

export type TemporalGetInput = {
  id?: number;
  bucket?: TemporalBucket;
  key?: string;
};
