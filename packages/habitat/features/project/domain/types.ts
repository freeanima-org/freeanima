import type { ProjectStatus } from "@freeanima/habitat/core/db/schema/entity";

export type {
  ProjectFolderRowPayload as ProjectFolderRow,
  ProjectRowPayload as ProjectRow,
} from "@freeanima/shared/rpc-contract/frames/project.ts";

export type ProjectFolderCreateInput = {
  name: string;
  parent_id?: number | null;
  sort_order?: number;
  client_op_id?: string;
};

export type ProjectFolderUpdateInput = {
  id: number;
  name?: string;
  parent_id?: number | null;
  sort_order?: number;
};

export type ProjectCreateInput = {
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  content?: string;
  folder_id?: number | null;
  product_tag?: string;
  sort_order?: number;
  client_op_id?: string;
};

export type ProjectUpdateInput = {
  id: number;
  title?: string;
  start_at?: string | null;
  end_at?: string | null;
  content?: string;
  folder_id?: number | null;
  product_tag?: string | null;
  status?: ProjectStatus;
  sort_order?: number;
  release_tasks?: boolean;
  linked_diary_ids?: number[];
};

export type ProjectListOpts = {
  folder_id?: number | null;
  status?: ProjectStatus;
};
