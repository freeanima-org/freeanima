export type { BookmarkRowPayload as BookmarkRow } from "@freeanima/shared/rpc-contract/frames/bookmark.ts";

export type BookmarkKind = "folder" | "url";

export type BookmarkCreateInput = {
  title: string;
  kind: BookmarkKind;
  url?: string | null;
  parent_id?: number | null;
  sort_order?: number;
  browser_id?: string | null;
  client_op_id?: string;
};

export type BookmarkUpdateInput = {
  id: number;
  title?: string;
  kind?: BookmarkKind;
  url?: string | null;
  parent_id?: number | null;
  sort_order?: number;
  browser_id?: string | null;
  client_op_id?: string;
};

export type BookmarkListOpts = {
  parent_id?: number | null;
  kind?: BookmarkKind;
  limit?: number;
  offset?: number;
};

export type BookmarkSearchOpts = {
  query: string;
  limit?: number;
  offset?: number;
};

export type BookmarkUpsertInput = {
  title: string;
  kind: BookmarkKind;
  url?: string | null;
  parent_browser_id?: string | null;
  parent_id?: number | null;
  sort_order?: number;
  browser_id: string;
  client_op_id?: string;
  deleted?: boolean;
};

export type BookmarkPullOpts = {
  updated_after?: string;
  limit?: number;
};
