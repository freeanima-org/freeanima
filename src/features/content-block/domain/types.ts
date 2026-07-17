import type { ContentBlockType, NarrativeSignificance } from "@freeanima/core/db/schema/entity";

export type ContentBlockLimbicInput = {
  valence: number;
  arousal: number;
  intensity: number;
};

export type ContentBlockNarrativeInput = {
  significance?: NarrativeSignificance;
};

export type ContentBlockSemanticRefInput = {
  semantic_memory_id: string;
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
};

export type ContentBlockListOpts = {
  parent_id: number;
  block_type?: ContentBlockType;
  /** 按语义组件 tag 过滤，如 limbic / narrative / semantic_ref */
  component?: string;
  limit?: number;
  offset?: number;
};

export type ContentBlockSearchOpts = {
  query: string;
  parent_id?: number;
  block_type?: ContentBlockType;
  component?: string;
  limit?: number;
};

export type ContentBlockReorderItem = {
  id: number;
  sort_order: number;
};
