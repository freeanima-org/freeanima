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
} from "@freeanima/frontend/ui-kit";

import type { ProjectFolderRow, ProjectRow } from "../lib/api.ts";
import { isFolderDescendant } from "../lib/project-tree.ts";

export type ProjectEditorTarget =
  | { kind: "folder"; folder: ProjectFolderRow }
  | { kind: "project"; project: ProjectRow };

type ProjectEditorDialogProps = {
  open: boolean;
  target: ProjectEditorTarget | null;
  folders: ProjectFolderRow[];
  onClose: () => void;
  onSave: (input: { name: string; folderId: number | null }) => void | Promise<void>;
};

export function ProjectEditorDialog({
  open,
  target,
  folders,
  onClose,
  onSave,
}: ProjectEditorDialogProps) {
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const folderOptions = useMemo(() => {
    if (target == null) return [];
    if (target.kind === "folder") {
      return folders
        .filter((row) => row.id !== target.folder.id)
        .filter((row) => !isFolderDescendant(folders, target.folder.id, row.id))
        .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }
    return folders.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }, [folders, target]);

  useEffect(() => {
    if (!open || target == null) return;
    if (target.kind === "folder") {
      setName(target.folder.name);
      setFolderId(target.folder.parent_id ?? null);
    } else {
      setName(target.project.title);
      setFolderId(target.project.folder_id ?? null);
    }
    setSaving(false);
  }, [open, target]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || target == null || saving) return;
    setSaving(true);
    try {
      await onSave({ name: trimmed, folderId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = target?.kind === "folder" ? "编辑文件夹" : "编辑项目";
  const nameLabel = target?.kind === "folder" ? "名称" : "标题";
  const folderLabel = target?.kind === "folder" ? "所属文件夹" : "所属文件夹";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-edit-name">{nameLabel}</Label>
            <Input
              id="project-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              focusOnMount
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-edit-folder">{folderLabel}</Label>
            <select
              id="project-edit-folder"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={folderId == null ? "" : String(folderId)}
              onChange={(e) => {
                const raw = e.target.value;
                setFolderId(raw === "" ? null : Number(raw));
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
