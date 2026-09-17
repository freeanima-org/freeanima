export type TaskAdvanceReminderPayload = {
  task_item_id: number;
  title: string;
  body: string;
  at: string;
  source_ref: string;
};

const watchers = new Set<(payload: TaskAdvanceReminderPayload) => void>();

export function watchTaskAdvanceReminder(
  cb: (payload: TaskAdvanceReminderPayload) => void,
): () => void {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}

export function emitTaskAdvanceReminder(payload: TaskAdvanceReminderPayload): void {
  for (const cb of watchers) {
    cb(payload);
  }
}

/** @internal */
export function resetTaskAdvanceReminderWatchersForTest(): void {
  watchers.clear();
}
