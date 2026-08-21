import { useEffect, useSyncExternalStore } from "react";

import { useUserSubjectId } from "./use-user-subject-id.ts";
import {
  ensureShellQuickEntries,
  getShellQuickEntriesSnapshot,
  subscribeShellQuickEntries,
  type ShellQuickEntry,
} from "./shell-quick.ts";

export function useShellQuickEntries(): ShellQuickEntry[] {
  const subjectId = useUserSubjectId();
  const entries = useSyncExternalStore(
    subscribeShellQuickEntries,
    getShellQuickEntriesSnapshot,
    () => [],
  );

  useEffect(() => {
    if (subjectId == null) return;
    void ensureShellQuickEntries().catch(() => {
      /* 离线 / 未连 Habitat 时保持空列表 */
    });
  }, [subjectId]);

  return entries;
}

export function useShellQuickIdSet(): ReadonlySet<number> {
  const entries = useShellQuickEntries();
  return new Set(entries.map((e) => e.id));
}
