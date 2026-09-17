import { useCallback, useEffect, useState } from "react";

import { Button, Dialog, DialogHeader, DialogTitle, Input, Spinner, cn } from "@freeanima/ui-kit";

import {
  pomodoroLinkBadgeLabel,
  searchPendingLinksForPicker,
  type PomodoroLinkPickRow,
} from "../lib/task-picker-api.ts";

type TaskPickerDialogProps = {
  open: boolean;
  selectedTaskId: number | null;
  selectedEventId: number | null;
  onSelect: (link: PomodoroLinkPickRow | null) => void;
  onClose: () => void;
};

function isSelected(
  item: PomodoroLinkPickRow,
  selectedTaskId: number | null,
  selectedEventId: number | null,
): boolean {
  if (item.kind === "task") return selectedTaskId === item.id;
  return selectedEventId === item.id;
}

function badgeToneClass(item: PomodoroLinkPickRow): string {
  if (item.kind === "event") return "bg-primary/15 text-primary";
  if (item.project_id != null) return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function TaskPickerDialog({
  open,
  selectedTaskId,
  selectedEventId,
  onSelect,
  onClose,
}: TaskPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PomodoroLinkPickRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadItems = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError("");
    try {
      const rows = await searchPendingLinksForPicker(searchQuery);
      setItems(rows);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    void loadItems("");
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return () => {};
    const id = window.setTimeout(() => void loadItems(query), 280);
    return () => clearTimeout(id);
  }, [open, query, loadItems]);

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-h-[min(80vh,32rem)] gap-3 overflow-hidden sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>选择关联</DialogTitle>
      </DialogHeader>

      <Input
        placeholder="搜索任务或事件标题…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="h-[min(50vh,20rem)] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-destructive px-1 py-4 text-sm">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-sm">
            {query.trim() ? "没有匹配的条目" : "今日议程暂无可关联条目"}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                    isSelected(item, selectedTaskId, selectedEventId) && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <span
                    className={cn(
                      "max-w-[40%] shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] tracking-wide",
                      badgeToneClass(item),
                    )}
                    title={pomodoroLinkBadgeLabel(item)}
                  >
                    {pomodoroLinkBadgeLabel(item)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          onSelect(null);
          onClose();
        }}
      >
        不关联
      </Button>
    </Dialog>
  );
}
