import { useEffect, useRef, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";

import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";

import { fetchTaskItemById, updateTaskItem, type TaskItemRow } from "./lib/api.ts";
import { TaskDetailPanel } from "./components/TaskDetailPanel.tsx";

export function TaskEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [item, setItem] = useState<TaskItemRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
          setItem(next);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            void updateTaskItem(
              next.id,
              {
                title: next.title,
                content: next.content,
                tag_ids: next.tag_ids,
                priority: next.priority,
                due_at: next.due_at,
                status: next.status,
                recurrence: next.recurrence ?? null,
                ...(next.recurrence ? { only_this: true } : {}),
              },
              { seed: next },
            ).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          }, 700);
        }}
      />
    </div>
  );
}
