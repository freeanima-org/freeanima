export type DiarySubjectKind = "user" | "agent";

/** diary 容器下的 text content_block（UI/SAP/Tool 共用精简形状） */
export type DiaryTextBlock = {
  id: number;
  title: string;
  content: string;
  sort_order: number;
  parent_id: number;
  client_op_id: string | null;
  /** entity.components；含 dream/limbic/narrative 等语义 tag */
  components: string[];
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type DiaryEntryRow = {
  id: number;
  title: string;
  summary: string;
  entry_at: string;
  /** 顶层 entities.tag_ids（指向同 World 的 tag entity） */
  tag_ids: number[];
  /** 正文块；list/search 恒为 []，get/create/append/update 带完整块 */
  blocks: DiaryTextBlock[];
  created_at: string;
  updated_at: string;
};

export type DiaryEntryCreateInput = {
  title: string;
  /** 若有则建首条 text block；不写容器 content */
  content?: string;
  summary?: string;
  entry_at: string;
  /** 标签名（ensure 为 tag entity）；与 tag_ids 合并 */
  tags?: string[];
  tag_ids?: number[];
  client_op_id?: string;
};

export type DiaryEntryUpdateInput = {
  id: number;
  title?: string;
  summary?: string;
  entry_at?: string;
  tags?: string[];
  tag_ids?: number[];
};

export type DiaryEntryAppendInput = {
  id: number;
  content: string;
  client_op_id?: string;
};

export type DiaryEntryAppendByDateInput = {
  date?: string;
  content: string;
  tags?: string[];
  tag_ids?: number[];
};

export type DiaryEntryUpdateByDateInput = {
  date?: string;
  title?: string;
  summary?: string;
  tags?: string[];
  tag_ids?: number[];
};

export type DiaryEntryListOpts = {
  entry_after?: string;
  entry_before?: string;
  tag_ids?: number[];
  limit?: number;
  offset?: number;
};

export type DiaryEntrySearchOpts = {
  query: string;
  entry_after?: string;
  entry_before?: string;
  tag_ids?: number[];
  limit?: number;
};

export type DiaryTextBlockCreateInput = {
  parent_id: number;
  content: string;
  title?: string;
  tag_ids?: number[];
  components?: string[];
  sort_order?: number;
  client_op_id?: string;
};

export type DiaryTextBlockUpdateInput = {
  id: number;
  content?: string;
  title?: string;
  tag_ids?: number[];
  sort_order?: number;
};

export type DiaryTextBlockReorderItem = {
  id: number;
  sort_order: number;
};

export type DiaryBlockTemplatePreset = {
  title: string;
  content: string;
  components: string[];
  tag_ids: number[];
};

export type DiaryBlockTemplateRow = {
  id: number;
  /** 模板名称（entities.title） */
  name: string;
  sort_order: number;
  preset: DiaryBlockTemplatePreset;
  created_at: string;
  updated_at: string;
};

export type DiaryBlockTemplateCreateInput = {
  name: string;
  preset: DiaryBlockTemplatePreset;
  sort_order?: number;
  client_op_id?: string;
};

export type DiaryBlockTemplateUpdateInput = {
  id: number;
  name?: string;
  preset?: Partial<DiaryBlockTemplatePreset>;
  sort_order?: number;
};

export type DiaryStoreContext = {
  worldId: number;
};
