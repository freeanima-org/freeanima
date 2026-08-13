import { useEffect, useMemo, useState } from "react";

import { Button, Input } from "../components/ui/index.ts";
import { ModalSheetPresent } from "./ModalSheetPresent.tsx";

export type ProjectPickerRow = {
  id: number;
  title: string;
  status: string;
};

export type MoveToProjectPickerProps = {
  open: boolean;
  projects: ProjectPickerRow[];
  currentProjectId: number | null;
  title?: string;
  onSelect: (projectId: number) => void;
  onClose: () => void;
};

export function MoveToProjectPicker({
  open,
  projects,
  currentProjectId,
  title = "移动到项目",
  onSelect,
  onClose,
}: MoveToProjectPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const active = projects.filter((p) => p.status === "active" || p.status === "on_hold");
    if (!q) return active;
    return active.filter((p) => p.title.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  return (
    <ModalSheetPresent open={open} onClose={onClose} aria-label={title}>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <Input
          type="search"
          className="mt-2 h-8 w-full"
          placeholder="搜索项目…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <ul className="h-[min(50vh,20rem)] overflow-y-auto p-2">
        {filtered.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              disabled={project.id === currentProjectId}
              className="hover:bg-muted flex w-full min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40"
              onClick={() => {
                onSelect(project.id);
                onClose();
              }}
            >
              <span className="min-w-0 flex-1 truncate">{project.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{project.status}</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="text-muted-foreground px-3 py-4 text-sm">没有匹配的项目</li>
        ) : null}
      </ul>
      <div className="border-t p-2">
        <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
          取消
        </Button>
      </div>
    </ModalSheetPresent>
  );
}
