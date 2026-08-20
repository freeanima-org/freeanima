/** 单条数据完整性问题（只读检测，不含修复动作） */
export type DataIntegrityIssue = {
  code: string;
  message: string;
  entity_id?: number;
};

export type EntityIntegritySnapshot = {
  id: number;
  type: string;
  world_id: number;
  primary_component: string | null;
  body: Record<string, unknown> | null;
  deleted_at?: Date | string | null;
};

export type ConfiguredSubjects = {
  user_subject_id?: number;
  agent_subject_id?: number;
};

export type DataIntegrityReport = {
  ok: boolean;
  entity_count: number;
  issue_count: number;
  /** 是否因 issueLimit 截断了返回列表 */
  truncated: boolean;
  issues: DataIntegrityIssue[];
};
