export type DreamEntryRow = {
  id: number;
  dream_day: string;
  content: string;
  source_limbic_ids: string[];
  source_conversation_ids: string[];
  episodic_snippets: import("@freeanima/habitat/core/db/schema/entity").DreamEpisodicSnippet[];
  legacy_id?: string;
  created_at: string;
};

export type DreamStoreContext = {
  worldId: number;
};

export type DreamEntryCreateInput = {
  dream_day: string;
  content: string;
  source_limbic_ids?: string[];
  source_conversation_ids?: string[];
  episodic_snippets?: DreamEntryRow["episodic_snippets"];
};

export type DreamEntryListOpts = {
  offset?: number;
  limit?: number;
};
