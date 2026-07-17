import type { ProjectStatus } from "@freeanima/core/db/schema/entity";

export type {
  ProjectFolderRowPayload as ProjectFolderRow,
  ProjectRowPayload as ProjectRow,
  MilestoneRowPayload as MilestoneRow,
} from "@freeanima/shared/sap-contract/frames/project.ts";

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
  start_at: string;
  end_at: string;
  completion_criteria: string;
  content?: string;
  folder_id?: number | null;
  product_tag?: string;
  sort_order?: number;
  client_op_id?: string;
};

export type ProjectUpdateInput = {
  id: number;
  title?: string;
  start_at?: string;
  end_at?: string;
  completion_criteria?: string;
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

export type MilestoneCreateInput = {
  project_id: number;
  title: string;
  due_at: string;
  sort_order?: number;
  client_op_id?: string;
};

export type MilestoneUpdateInput = {
  id: number;
  title?: string;
  due_at?: string;
  status?: "pending" | "in_progress" | "completed" | "delayed";
  sort_order?: number;
};
