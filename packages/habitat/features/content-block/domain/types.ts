import type {
  ContentBlockType,
  LimbicKind,
  NarrativeSignificance,
  NarrativeStatus,
} from "@freeanima/habitat/core/db/schema/entity";

export type ContentBlockLimbicInput = {
  valence: number;
  arousal: number;
  intensity: number;
  kind?: LimbicKind;
  conversation_id?: string;
  source_segment?: string | null;
  semantic_memory_ids?: number[];
};

export type ContentBlockNarrativeInput = {
  significance?: NarrativeSignificance;
  status?: NarrativeStatus;
  period_start?: string | null;
  period_end?: string | null;
  source_facts?: number[];
  source_conversations?: string[];
};

export type ContentBlockSemanticRefInput = {
  entity_id: number;
};

export type ContentBlockDreamInput = {
  source_limbic_ids?: string[];
  source_conversation_ids?: string[];
};

export type ContentBlockRow = {
  id: number;
  title: string;
  content: string;
  summary: string;
  block_type: ContentBlockType;
  parent_id: number;
  sort_order: number;
  url: string | null;
  client_op_id: string | null;
  components: string[];
  limbic: ContentBlockLimbicInput | null;
  narrative: ContentBlockNarrativeInput | null;
  semantic_ref: ContentBlockSemanticRefInput | null;
  dream: ContentBlockDreamInput | null;
  created_at: string;
  updated_at: string;
};

export type ContentBlockCreateInput = {
  parent_id: number;
  block_type: ContentBlockType;
  content?: string;
  title?: string;
  summary?: string;
  sort_order?: number;
  url?: string | null;
  client_op_id?: string;
  limbic?: ContentBlockLimbicInput;
  narrative?: ContentBlockNarrativeInput;
  semantic_ref?: ContentBlockSemanticRefInput;
  dream?: ContentBlockDreamInput;
};

export type ContentBlockUpdateInput = {
  id: number;
  content?: string;
  title?: string;
  summary?: string;
  block_type?: ContentBlockType;
  parent_id?: number;
  sort_order?: number;
  url?: string | null;
  /** 传 null 清除 limbic 组件；省略则不变 */
  limbic?: ContentBlockLimbicInput | null;
  narrative?: ContentBlockNarrativeInput | null;
  semantic_ref?: ContentBlockSemanticRefInput | null;
  dream?: ContentBlockDreamInput | null;
};

export type ContentBlockListOpts = {
  parent_id: number;
  block_type?: ContentBlockType;
  /** 按语义组件 tag 过滤，如 limbic / narrative / dream / semantic_ref */
  component?: string;
  limit?: number;
  offset?: number;
};

export type ContentBlockSearchOrderBy =
  | "created_desc"
  | "created_asc"
  | "intensity_desc"
  | "intensity_asc"
  | "valence_desc"
  | "valence_asc";

export type ContentBlockSearchOpts = {
  /** 空则 filter_only / 列表过滤 */
  query?: string;
  parent_id?: number;
  block_type?: ContentBlockType;
  component?: string;
  conversation_id?: string;
  kind?: LimbicKind;
  /** narrative.status；component=narrative 时默认 active；传 all 不过滤 */
  status?: NarrativeStatus | "all";
  min_intensity?: number;
  max_intensity?: number;
  min_valence?: number;
  max_valence?: number;
  order_by?: ContentBlockSearchOrderBy;
  limit?: number;
};

export type ContentBlockReorderItem = {
  id: number;
  sort_order: number;
};
