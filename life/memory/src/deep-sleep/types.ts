/** Deep sleep three-round intent labels */
export type DeepSleepRound = "contradiction_expiry" | "split" | "merge";

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
    source_sessions: string[];
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

/** Deep sleep single-round run record (for log files) */
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

/** Deep sleep full-run result */
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
