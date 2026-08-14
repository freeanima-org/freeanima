export type NoteSubjectKind = "user" | "agent";

/** note 容器下的 text content_block */
export type NoteTextBlock = {
  id: number;
  title: string;
  content: string;
  sort_order: number;
  parent_id: number;
  client_op_id: string | null;
  components: string[];
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type NoteRow = {
  id: number;
  title: string;
  summary: string;
  tag_ids: number[];
  /**
   * 正文块。
   * - list：恒为 []
   * - search：命中块摘要
   * - get/create/append/update：完整块
   */
  blocks: NoteTextBlock[];
  created_at: string;
  updated_at: string;
};

export type NoteCreateInput = {
  title: string;
  content?: string;
  summary?: string;
  tags?: string[];
  tag_ids?: number[];
  client_op_id?: string;
};

export type NoteUpdateInput = {
  id: number;
  title?: string;
  summary?: string;
  tags?: string[];
  tag_ids?: number[];
};

export type NoteAppendInput = {
  id: number;
  content: string;
  client_op_id?: string;
};

export type NoteListOpts = {
  tag_ids?: number[];
  limit?: number;
  offset?: number;
};

export type NoteSearchOpts = {
  query: string;
  tag_ids?: number[];
  limit?: number;
};

export type NoteTextBlockCreateInput = {
  parent_id: number;
  content: string;
  title?: string;
  tag_ids?: number[];
  components?: string[];
  sort_order?: number;
  client_op_id?: string;
};

export type NoteTextBlockUpdateInput = {
  id: number;
  content?: string;
  title?: string;
  tag_ids?: number[];
  sort_order?: number;
};

export type NoteTextBlockReorderItem = {
  id: number;
  sort_order: number;
};

export type NoteStoreContext = {
  worldId: number;
};
