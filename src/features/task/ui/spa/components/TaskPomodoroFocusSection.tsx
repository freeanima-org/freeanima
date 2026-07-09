import { useEffect, useState } from "react";
import { FormFieldLabel } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";

import { fetchTaskPomodoroFocus, type TaskPomodoroFocusRow } from "../lib/pomodoro-focus-api.ts";

function formatFocusDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  return `${min} 分钟`;
}

function formatFocusTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type TaskPomodoroFocusSectionProps = {
  taskId: number;
};

export function TaskPomodoroFocusSection({ taskId }: TaskPomodoroFocusSectionProps) {
  const [items, setItems] = useState<TaskPomodoroFocusRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTaskPomodoroFocus(taskId, 20).then((rows) => {
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return <p className="text-muted-foreground text-xs">加载专注记录…</p>;
  }
  if (items.length === 0) return null;

  return (
    <div>
      <FormFieldLabel>番茄专注</FormFieldLabel>
      <ul className="text-muted-foreground space-y-1 text-xs">
        {items.map((row) => (
          <li key={row.id}>
            {formatFocusTime(row.started_at)} · {formatFocusDuration(row.duration_ms)}
          </li>
        ))}
      </ul>
    </div>
  );
}
