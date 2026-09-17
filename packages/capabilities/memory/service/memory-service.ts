import type {
  CiteInput,
  CiteResult,
  ListMemoryInput,
  MemoryDeployment,
  MemoryRecord,
  MemorySearchInput,
  RecallInput,
  RecallResult,
  ReflectInput,
  ReflectResult,
  RememberInput,
  RetainInput,
  RetainResult,
  SyncTurnInput,
  SyncTurnResult,
  TemporalGetInput,
  TemporalListInput,
  TemporalRecord,
  UpdateMemoryInput,
} from "./types.ts";

/**
 * 记忆运行时统一门面（#16102）。
 * deployment: embedded | remote 同契约；非 Hermes 多 Provider。
 */
export type MemoryService = {
  readonly deployment: MemoryDeployment;

  syncTurn(input: SyncTurnInput): Promise<SyncTurnResult>;
  retain(input: RetainInput): Promise<RetainResult>;
  recall(input: RecallInput): Promise<RecallResult>;
  search(input?: MemorySearchInput): Promise<MemoryRecord[]>;
  reflect(input?: ReflectInput): Promise<ReflectResult>;

  remember(input: RememberInput): Promise<MemoryRecord>;
  update(input: UpdateMemoryInput): Promise<MemoryRecord>;
  deprecate(id: number): Promise<void>;
  get(id: number): Promise<MemoryRecord | null>;
  list(input?: ListMemoryInput): Promise<MemoryRecord[]>;
  pin(id: number): Promise<void>;
  unpin(id: number): Promise<void>;

  cite(input: CiteInput): Promise<CiteResult>;
  listResident(opts?: { topN?: number }): Promise<MemoryRecord[]>;
  assembleResidentBlock(opts?: { topN?: number }): Promise<string>;

  temporal: {
    list(input?: TemporalListInput): Promise<TemporalRecord[]>;
    get(input: TemporalGetInput): Promise<TemporalRecord | null>;
    search?(query: string, opts?: { limit?: number }): Promise<TemporalRecord[]>;
    regenerate?(input: { bucket: TemporalRecord["bucket"]; key: string }): Promise<TemporalRecord>;
  };
};
