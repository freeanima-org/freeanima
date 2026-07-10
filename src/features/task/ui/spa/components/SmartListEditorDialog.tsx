import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@freeanima/frontend/ui-kit";

import type { SmartListRow, TaskItemSearchFilters, TaskListRow } from "../lib/api.ts";
import {
  buildListTree,
  flattenVisibleTree,
} from "@freeanima/frontend/ui-kit/lib/task-list-tree.ts";

type SmartListEditorDialogProps = {
  open: boolean;
  initial?: SmartListRow | null;
  lists: TaskListRow[];
  onClose: () => void;
  onSave: (input: { title: string; filters: TaskItemSearchFilters }) => void | Promise<void>;
};

const STATUS_OPTIONS: Array<{ value: TaskItemSearchFilters["status"]; label: string }> = [
  { value: "pending", label: "待办" },
  { value: "completed", label: "已完成" },
  { value: "all", label: "全部" },
];

function readInitialListIds(filters: TaskItemSearchFilters | undefined): number[] {
  if (filters?.list_ids?.length) return [...filters.list_ids];
  if (filters?.list_id != null) return [filters.list_id];
  return [];
}

export function SmartListEditorDialog({
  open,
  initial,
  lists,
  onClose,
  onSave,
}: SmartListEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskItemSearchFilters["status"]>("pending");
  const [dueMode, setDueMode] = useState<"none" | "today" | "tomorrow" | "next7">("none");
  const [completedMode, setCompletedMode] = useState<"none" | "today" | "yesterday" | "last7">(
    "none",
  );
  const [selectedListIds, setSelectedListIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const activeLists = useMemo(() => lists.filter((l) => !l.closed), [lists]);
  const expandedFolderIds = useMemo(
    () => new Set(activeLists.filter((l) => l.is_folder).map((l) => l.id)),
    [activeLists],
  );
  const visibleTree = useMemo(() => {
    const tree = buildListTree(activeLists);
    return flattenVisibleTree(tree, expandedFolderIds);
  }, [activeLists, expandedFolderIds]);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    const f = initial?.filters ?? { status: "pending" };
    setStatus(f.status ?? "pending");
    setSelectedListIds(readInitialListIds(f));
    if (f.completed_on === "today") setCompletedMode("today");
    else if (f.completed_on === "yesterday") setCompletedMode("yesterday");
    else if (f.completed_on_or_after_days === 6) setCompletedMode("last7");
    else setCompletedMode("none");
    if (f.due_on === "tomorrow") setDueMode("tomorrow");
    else if (f.due_on_or_before_days === 0) setDueMode("today");
    else if (f.due_on_or_before_days === 7) setDueMode("next7");
    else setDueMode("none");
  }, [open, initial]);

  const toggleListId = (listId: number) => {
    setSelectedListIds((prev) =>
      prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId],
    );
  };

  const buildFilters = (): TaskItemSearchFilters => {
    const filters: TaskItemSearchFilters = {};
    if (status) filters.status = status;
    if (selectedListIds.length > 0) {
      filters.list_ids = selectedListIds.toSorted((a, b) => a - b);
    }
    if (status === "completed") {
      if (completedMode === "today") filters.completed_on = "today";
      if (completedMode === "yesterday") filters.completed_on = "yesterday";
      if (completedMode === "last7") filters.completed_on_or_after_days = 6;
      return filters;
    }
    if (dueMode === "today") {
      filters.has_due_at = true;
      filters.due_on_or_before_days = 0;
    } else if (dueMode === "tomorrow") {
      filters.due_on = "tomorrow";
    } else if (dueMode === "next7") {
      filters.has_due_at = true;
      filters.due_on_or_before_days = 7;
    }
    return filters;
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave({ title: trimmed, filters: buildFilters() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id != null ? "编辑智能清单" : "新建智能清单"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="smart-list-title">名称</Label>
            <Input
              id="smart-list-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="我的智能清单"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="smart-list-status">状态</Label>
            <select
              id="smart-list-status"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={status ?? "pending"}
              onChange={(e) => setStatus(e.target.value as TaskItemSearchFilters["status"])}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value ?? "all"} value={opt.value ?? "all"}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {status !== "completed" ? (
            <div className="space-y-1">
              <Label htmlFor="smart-list-due">截止日期</Label>
              <select
                id="smart-list-due"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={dueMode}
                onChange={(e) => setDueMode(e.target.value as typeof dueMode)}
              >
                <option value="none">不限</option>
                <option value="today">今天及已过期</option>
                <option value="tomorrow">明天</option>
                <option value="next7">未来7天（含已过期）</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="smart-list-completed">完成时间</Label>
              <select
                id="smart-list-completed"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={completedMode}
                onChange={(e) => setCompletedMode(e.target.value as typeof completedMode)}
              >
                <option value="none">不限</option>
                <option value="today">今日完成</option>
                <option value="yesterday">昨日完成</option>
                <option value="last7">最近7天完成</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>清单</Label>
            <p className="text-muted-foreground text-xs">
              可多选；不选则包含全部清单。文件夹不可选。
            </p>
            <div className="border-input max-h-40 overflow-y-auto rounded-md border p-2">
              {visibleTree.length === 0 ? (
                <p className="text-muted-foreground px-1 py-2 text-sm">暂无可用清单</p>
              ) : (
                <ul className="space-y-0.5">
                  {visibleTree.map(({ list, depth }) =>
                    list.is_folder ? (
                      <li
                        key={list.id}
                        className="text-muted-foreground flex items-center gap-1 px-1 py-1 text-xs font-medium"
                        style={{ paddingLeft: `${depth * 12 + 4}px` }}
                      >
                        <span aria-hidden>📁</span>
                        <span className="truncate">{list.name}</span>
                      </li>
                    ) : (
                      <li key={list.id}>
                        <label
                          className="hover:bg-muted flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm"
                          style={{ paddingLeft: `${depth * 12 + 4}px` }}
                        >
                          <Checkbox
                            checked={selectedListIds.includes(list.id)}
                            onCheckedChange={() => toggleListId(list.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">{list.name}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {list.item_count}
                          </span>
                        </label>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void handleSave()}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
