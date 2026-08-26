import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import {
  AUTO_PERSIST_SHORT,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";

import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";

import {
  completeTaskItem,
  fetchTaskItemById,
  uncompleteTaskItem,
  updateTaskItem,
  type TaskItemRow,
} from "./lib/api.ts";
import {
  buildTaskOverlayFieldPatch,
  classifyTaskOverlayChange,
} from "./lib/task-entity-overlay-persist.ts";
import { TaskDetailPanel } from "./components/TaskDetailPanel.tsx";

export function TaskEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [item, setItem] = useState<TaskItemRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const itemRef = useRef<TaskItemRow | null>(null);
  const pendingFieldsRef = useRef<TaskItemRow | null>(null);
  const mountedRef = useRef(true);

  itemRef.current = item;

  const persistFields = useMemo(
    () => () => {
      const snap = pendingFieldsRef.current;
      if (!snap) return;
      pendingFieldsRef.current = null;
      void updateTaskItem(snap.id, buildTaskOverlayFieldPatch(snap), { seed: snap })
        .then((saved) => {
          if (!mountedRef.current) return;
          setItem((prev) => (prev != null && prev.id === saved.id ? saved : prev));
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    },
    [],
  );

  const fieldScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        debounceMs: AUTO_PERSIST_SHORT.debounceMs,
        maxWaitMs: AUTO_PERSIST_SHORT.maxWaitMs,
        onFire: () => persistFields(),
      }),
    [persistFields],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fieldScheduler.flush();
    };
  }, [fieldScheduler]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTaskItemById(id)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError("未找到该任务");
          setItem(null);
        } else {
          setItem(row);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center p-6">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-3 p-4 pr-10">
        <p className="text-sm text-destructive">{error ?? "未找到该任务"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-2 pr-10">
        <EntityIdLabel id={item.id} animaComponent="task_item" />
      </div>
      <TaskDetailPanel
        item={item}
        onChange={(next) => {
          const prev = itemRef.current;
          setItem(next);
          if (prev == null) return;

          if (classifyTaskOverlayChange(prev, next) === "status") {
            // 先落盘未发出的文本改动，再立刻 complete/uncomplete（禁止 debounce status）
            fieldScheduler.flush();
            void (
              next.status === "completed" ? completeTaskItem(next.id) : uncompleteTaskItem(next.id)
            )
              .then((saved) => {
                if (!mountedRef.current) return;
                setItem(saved);
              })
              .catch((err) => {
                if (!mountedRef.current) return;
                setError(err instanceof Error ? err.message : String(err));
              });
            return;
          }

          pendingFieldsRef.current = next;
          fieldScheduler.schedule();
        }}
      />
    </div>
  );
}
