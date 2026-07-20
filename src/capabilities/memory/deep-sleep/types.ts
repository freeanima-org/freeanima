/** Deep sleep round intent labels */
import { omitUndefined } from "@freeanima/core/util";

export type DeepSleepRound = "contradiction_expiry" | "split" | "merge" | "pin_maintenance";

/** Deep sleep mode: full (manual trigger) or incremental (scheduled cron) */
export type DeepSleepMode = "full" | "incremental";

/** Single change record */
export type DeepSleepChangeEntry = {
  action: "added" | "modified" | "deprecated" | "merged_into";
  id: string;
  detail: string; // e.g. "merged into f-003", content summary
  /** Brief info for message 1.5 rendering when merged_into / added */
  mergedTarget?: {
    id: string;
    type: string;
    content: string;
    source_conversations: string[];
    observed_at: string | null;
  };
};

/** In-memory change log: each processed entry indexed by id */
export type DeepSleepChangeLog = {
  /** Old entries merged/deprecated/split → new state */
  entries: Record<string, DeepSleepChangeEntry>;
  /** Entry ids added this round */
  addedIds: string[];
  /** Entry ids modified this round */
  modifiedIds: string[];
  /** Entry ids deprecated this round (including merge source memories) */
  deprecatedIds: string[];
};

export function createEmptyChangeLog(): DeepSleepChangeLog {
  return { entries: {}, addedIds: [], modifiedIds: [], deprecatedIds: [] };
}

/** 深睡单轮结束时的 change log 快照（写入 pipeline output） */
export function snapshotChangeLog(log: DeepSleepChangeLog): DeepSleepChangeLog {
  return {
    entries: { ...log.entries },
    addedIds: [...log.addedIds],
    modifiedIds: [...log.modifiedIds],
    deprecatedIds: [...log.deprecatedIds],
  };
}

export function applyChangeLog(
  log: DeepSleepChangeLog,
  action: DeepSleepChangeEntry["action"],
  id: string,
  detail: string,
  mergedTarget?: DeepSleepChangeEntry["mergedTarget"],
): void {
  log.entries[id] = omitUndefined({ action, id, detail, mergedTarget });
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

/** Deep sleep full-run result（持久化于 pipeline_step_run.output） */
export type DeepSleepResult = {
  ok: boolean;
  day: string;
  rounds: {
    round: DeepSleepRound;
    round_index: number;
    tool_calls: number;
    summary: string;
    skipped?: string;
    change_log_snapshot: DeepSleepChangeLog;
  }[];
  total_tool_calls: number;
  skipped?: string;
};
