import { useEffect, useState } from "react";

import {
  getGlobalOutboxSummary,
  getModuleOutboxSummary,
  type GlobalOutboxSummary,
  type ModuleOutboxSummary,
} from "./offline-module-cap.ts";
import {
  resolveOutboxScope,
  subscribeOutboxChanges,
  type OfflineModuleId,
} from "./offline-outbox.ts";

const EMPTY_SUMMARY: GlobalOutboxSummary = {
  pending: 0,
  failed: 0,
  stale: 0,
  ops: [],
};

/** 全局 outbox 汇总；同 tab 入队/删除/状态变更时刷新（无轮询）。 */
export function useGlobalOutboxSummary(scope?: string): GlobalOutboxSummary {
  const resolvedScope = scope ?? resolveOutboxScope();
  const [summary, setSummary] = useState<GlobalOutboxSummary>(EMPTY_SUMMARY);

  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      void getGlobalOutboxSummary(resolvedScope).then((next) => {
        if (!cancelled) setSummary(next);
      });
    };
    refresh();
    const unsub = subscribeOutboxChanges((event) => {
      if (event.scope === resolvedScope) refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [resolvedScope]);

  return summary;
}

/** 单模块 outbox 汇总；`pending` 不含 failed/stale。 */
export function useModuleOutboxSummary(
  moduleId: OfflineModuleId,
  scope?: string,
): ModuleOutboxSummary {
  const resolvedScope = scope ?? resolveOutboxScope();
  const [summary, setSummary] = useState<ModuleOutboxSummary>(EMPTY_SUMMARY);

  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      void getModuleOutboxSummary(resolvedScope, moduleId).then((next) => {
        if (!cancelled) setSummary(next);
      });
    };
    refresh();
    const unsub = subscribeOutboxChanges((event) => {
      if (event.scope === resolvedScope) refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [moduleId, resolvedScope]);

  return summary;
}
