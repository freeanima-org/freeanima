export type { TagRowPayload as TagRow } from "@freeanima/shared/sap-contract/frames/tag.ts";

export type TagCreateInput = {
  title: string;
  sort_order?: number;
  client_op_id?: string;
};

export type TagUpdateInput = {
  id: number;
  title?: string;
  sort_order?: number;
};

export type TagSearchOpts = {
  query?: string;
  limit?: number;
  offset?: number;
};
