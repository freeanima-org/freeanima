import { useEffect, useSyncExternalStore } from "react";

import { useSubjectScope } from "./subject-scope-react.tsx";
import {
  ensureShellQuickEntries,
  getShellQuickEntriesSnapshot,
  subscribeShellQuickEntries,
  type ShellQuickEntry,
} from "./shell-quick.ts";

export function useShellQuickEntries(): ShellQuickEntry[] {
  const { kind } = useSubjectScope();
  const entries = useSyncExternalStore(
    subscribeShellQuickEntries,
    getShellQuickEntriesSnapshot,
    () => [],
  );

  useEffect(() => {
    void ensureShellQuickEntries().catch(() => {
      /* 离线 / 未连 Habitat 时保持空列表 */
    });
  }, [kind]);

  return entries;
}

export function useShellQuickIdSet(): ReadonlySet<number> {
  const entries = useShellQuickEntries();
  return new Set(entries.map((e) => e.id));
}
