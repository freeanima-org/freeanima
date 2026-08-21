import type {
  ObjectiveCompletion,
  ObjectiveLink,
  ObjectiveStatus,
} from "@freeanima/habitat/core/db/schema/entity";

export type ObjectiveResolvedProgress = {
  current: number;
  target: number;
  unit: string;
  ratio: number | null;
  source: "manual" | "tasks_completed" | "projects_completed" | "pomodoro" | "none";
};

export type ObjectiveRow = {
  id: number;
  title: string;
  content: string;
  parent_id: number | null;
  status: ObjectiveStatus;
  start_at: string | null;
  end_at: string | null;
  completion: ObjectiveCompletion;
  links: ObjectiveLink[];
  sort_order: number;
  resolved_progress?: ObjectiveResolvedProgress;
  created_at: string;
  updated_at: string;
};

export type ObjectiveListOpts = {
  parent_id?: number | null;
  status?: ObjectiveStatus;
  include_inactive?: boolean;
};

export type ObjectiveCreateInput = {
  title: string;
  content?: string;
  parent_id?: number | null;
  status?: ObjectiveStatus;
  start_at?: string | null;
  end_at?: string | null;
  completion?: ObjectiveCompletion;
  links?: ObjectiveLink[];
  sort_order?: number;
  client_op_id?: string;
};

export type ObjectiveUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  parent_id?: number | null;
  status?: ObjectiveStatus;
  start_at?: string | null;
  end_at?: string | null;
  completion?: ObjectiveCompletion;
  links?: ObjectiveLink[];
  sort_order?: number;
  client_op_id?: string;
};
