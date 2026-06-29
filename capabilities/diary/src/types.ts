export type DiaryEntryRow = {
  id: number;
  title: string;
  summary: string;
  content: string;
  entry_at: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type DiaryEntryCreateInput = {
  title: string;
  content?: string;
  summary?: string;
  entry_at: string;
  tags?: string[];
};

export type DiaryEntryUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  summary?: string;
  entry_at?: string;
  tags?: string[];
};

export type DiaryEntryAppendInput = {
  id: number;
  content: string;
};

export type DiaryEntryAppendByDateInput = {
  date?: string;
  content: string;
  tags?: string[];
};

export type DiaryEntryUpdateByDateInput = {
  date?: string;
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
};

export type DiaryEntryListOpts = {
  entry_after?: string;
  entry_before?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
};

export type DiaryEntrySearchOpts = {
  query: string;
  entry_after?: string;
  entry_before?: string;
  tags?: string[];
  limit?: number;
};

export type DiaryStoreContext = {
  worldId: number;
};
