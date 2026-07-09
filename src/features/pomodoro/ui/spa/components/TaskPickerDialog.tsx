import { useCallback, useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
} from "@freeanima/frontend/ui-kit";

import { searchPendingTasksForPicker, type PomodoroTaskPickRow } from "../lib/task-picker-api.ts";

type TaskPickerDialogProps = {
  open: boolean;
  selectedId: number | null;
  onSelect: (task: PomodoroTaskPickRow | null) => void;
  onClose: () => void;
};

export function TaskPickerDialog({ open, selectedId, onSelect, onClose }: TaskPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PomodoroTaskPickRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadItems = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError("");
    try {
      const rows = await searchPendingTasksForPicker(searchQuery);
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
    if (!open) return;
    const id = window.setTimeout(() => void loadItems(query), 280);
    return () => clearTimeout(id);
  }, [open, query, loadItems]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[min(80vh,32rem)] gap-3 overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择关联任务</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="搜索任务标题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <p className="text-destructive px-1 py-4 text-sm">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-1 py-4 text-sm">
              {query.trim() ? "没有匹配的任务" : "暂无未完成任务"}
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`hover:bg-muted w-full rounded-md px-3 py-2 text-left text-sm ${
                      selectedId === item.id ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <span className="line-clamp-2">{item.title}</span>
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
          不关联任务
        </Button>
      </DialogContent>
    </Dialog>
  );
}
