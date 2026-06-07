/** 深睡三轮意图标签 */
export type DeepSleepRound = "contradiction_expiry" | "split" | "merge";

/** 单条变更记录 */
export type DeepSleepChangeEntry = {
  action: "added" | "modified" | "deprecated" | "merged_into";
  id: string;
  detail: string; // 片段说明，如 "已合并到 f-003"、content 摘要
  /** merged_into / added 时携带新记忆的简要信息以供消息1.5渲染 */
  mergedTarget?: {
    id: string;
    type: string;
    content: string;
    source_sessions: string[];
    observed_at: string | null;
  };
};

/** 内存中维护的变更日志：每个已处理条目按 id 索引 */
export type DeepSleepChangeLog = {
  /** 已被合并/废弃/拆分的旧条目 → 新状态 */
  entries: Record<string, DeepSleepChangeEntry>;
  /** 本轮新增条目 id */
  addedIds: string[];
  /** 本轮修改条目 id */
  modifiedIds: string[];
  /** 本轮废弃条目 id（包括被合并的源记忆） */
  deprecatedIds: string[];
};

export function createEmptyChangeLog(): DeepSleepChangeLog {
  return { entries: {}, addedIds: [], modifiedIds: [], deprecatedIds: [] };
}

export function applyChangeLog(
  log: DeepSleepChangeLog,
  action: DeepSleepChangeEntry["action"],
  id: string,
  detail: string,
  mergedTarget?: DeepSleepChangeEntry["mergedTarget"],
): void {
  log.entries[id] = { action, id, detail, mergedTarget };
  switch (action) {
    case "added":
      log.addedIds.push(id);
      break;
    case "modified":
      log.modifiedIds.push(id);
      break;
    case "deprecated":
    case "merged_into":
      log.deprecatedIds.push(id);
      break;
  }
}

/** 深度睡眠一轮运行记录（用于日志文件） */
export type DeepSleepRoundLog = {
  day: string;
  round: DeepSleepRound;
  round_index: number;
  started_at: string;
  finished_at: string;
  input: {
    active_memory_count: number;
    prior_deprecated_count: number;
    prior_added_count: number;
    prior_modified_count: number;
  };
  output: {
    tool_calls: number;
    summary: string;
  };
  change_log_snapshot: DeepSleepChangeLog;
};

/** 深睡全流程结果 */
export type DeepSleepResult = {
  ok: boolean;
  day: string;
  rounds: {
    round: DeepSleepRound;
    tool_calls: number;
    summary: string;
    skipped?: string;
  }[];
  total_tool_calls: number;
  skipped?: string;
};
