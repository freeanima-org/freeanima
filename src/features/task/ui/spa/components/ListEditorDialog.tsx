import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@freeanima/ui-kit";
import { isDescendant } from "@freeanima/ui-kit/lib/task-list-tree.ts";

import type { TaskListRow } from "../lib/api.ts";

type ListEditorDialogProps = {
  open: boolean;
  list: TaskListRow | null;
  lists: TaskListRow[];
  onClose: () => void;
  onSave: (input: { name: string; parent_id: number | null }) => void | Promise<void>;
};

export function ListEditorDialog({ open, list, lists, onClose, onSave }: ListEditorDialogProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const folderOptions = useMemo(() => {
    if (list == null) return [];
    return lists
      .filter((row) => !row.closed && row.is_folder && row.id !== list.id)
      .filter((row) => !isDescendant(lists, list.id, row.id))
      .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }, [list, lists]);

  useEffect(() => {
    if (!open || list == null) return;
    setName(list.name);
    setParentId(list.parent_id);
    setSaving(false);
  }, [open, list]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || list == null || saving) return;
    setSaving(true);
    try {
      await onSave({ name: trimmed, parent_id: parentId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{list?.is_folder ? "编辑文件夹" : "编辑清单"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-edit-name">名称</Label>
            <Input
              id="list-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              focusOnMount
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-edit-parent">所属文件夹</Label>
            <select
              id="list-edit-parent"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={parentId == null ? "" : String(parentId)}
              onChange={(e) => {
                const raw = e.target.value;
                setParentId(raw === "" ? null : Number(raw));
              }}
            >
              <option value="">无（顶级）</option>
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
