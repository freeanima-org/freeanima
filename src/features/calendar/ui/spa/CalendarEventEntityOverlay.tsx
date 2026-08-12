import { useEffect, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";

import { fetchCalendarEventById, type CalendarEventRow } from "./lib/api.ts";

function formatRange(ev: CalendarEventRow): string {
  if (ev.all_day) {
    const start = ev.start_at.slice(0, 10);
    const end = ev.end_at?.slice(0, 10);
    return end && end !== start ? `${start} → ${end}（全天）` : `${start}（全天）`;
  }
  const start = new Date(ev.start_at);
  const startText = Number.isNaN(start.getTime())
    ? ev.start_at
    : start.toLocaleString("zh-CN", { hour12: false });
  if (!ev.end_at) return startText;
  const end = new Date(ev.end_at);
  const endText = Number.isNaN(end.getTime())
    ? ev.end_at
    : end.toLocaleString("zh-CN", { hour12: false });
  return `${startText} → ${endText}`;
}

/**
 * calendar_event 专用实体浮层：展示标题、时段、正文等基础信息。
 */
export function CalendarEventEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [row, setRow] = useState<CalendarEventRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCalendarEventById(id)
      .then((item) => {
        if (cancelled) return;
        if (!item) {
          setError("未找到该日历事件");
          setRow(null);
        } else {
          setRow(item);
        }
      })
      .catch((err: unknown) => {
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

  if (error || !row) {
    return (
      <div className="space-y-3 p-4 pr-10">
        <p className="text-sm text-destructive">{error ?? "未找到该日历事件"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-2 pr-10">
        <EntityIdLabel id={row.id} animaComponent="calendar_event" />
        <span className="text-xs text-muted-foreground">{"日历事件"}</span>
      </div>
      <div className="space-y-3 p-4 pr-10">
        <h2 className="text-base font-semibold break-words">{row.title || `事件 #${row.id}`}</h2>
        <p className="text-sm text-muted-foreground">{formatRange(row)}</p>
        {row.remind_at ? (
          <p className="text-xs text-muted-foreground">
            {"提醒："}
            {new Date(row.remind_at).toLocaleString("zh-CN", { hour12: false })}
          </p>
        ) : null}
        {row.content.trim() ? (
          <p className="whitespace-pre-wrap text-sm break-words">{row.content}</p>
        ) : null}
      </div>
    </div>
  );
}
