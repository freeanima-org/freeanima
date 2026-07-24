import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button, Input } from "@freeanima/ui-kit";
import { useCompactLayout } from "@freeanima/ui-kit/layout";

type ProjectPickerRow = {
  id: number;
  title: string;
  status: string;
};

type MoveToProjectPickerProps = {
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
  const mobileLayout = useCompactLayout();
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setSearchQuery("");
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const active = projects.filter((p) => p.status === "active" || p.status === "on_hold");
    if (!q) return active;
    return active.filter((p) => p.title.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  if (!open || !visible || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-black/50" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          mobileLayout
            ? "bg-background fixed inset-x-0 bottom-0 z-[101] flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t shadow-lg safe-area-pb"
            : "bg-background fixed top-1/2 left-1/2 z-[101] flex max-h-[min(85vh,32rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border shadow-lg"
        }
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
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
        <ul className="max-h-[50vh] overflow-y-auto p-2">
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
      </div>
    </>,
    document.body,
  );
}
