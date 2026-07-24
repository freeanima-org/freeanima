export type UserNotificationCreatedPayload = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const watchers = new Set<(payload: UserNotificationCreatedPayload) => void>();

export function watchUserNotificationCreated(
  cb: (payload: UserNotificationCreatedPayload) => void,
): () => void {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}

export function emitUserNotificationCreated(payload: UserNotificationCreatedPayload): void {
  for (const cb of watchers) {
    cb(payload);
  }
}

/** @internal */
export function resetUserNotificationWatchersForTest(): void {
  watchers.clear();
}
