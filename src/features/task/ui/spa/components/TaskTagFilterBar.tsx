import type { JSX } from "react";

import type { TaskTagFilterRow } from "../lib/task-tag-filter.ts";

type TaskTagFilterBarProps = {
  tags: TaskTagFilterRow[];
  value: number | null;
  onChange: (tagId: number | null) => void;
};

function chipClass(selected: boolean): string {
  return [
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs transition-colors",
    selected
      ? "bg-primary/15 text-foreground font-medium"
      : "bg-muted text-muted-foreground hover:bg-muted/80",
  ].join(" ");
}

export function TaskTagFilterBar({
  tags,
  value,
  onChange,
}: TaskTagFilterBarProps): JSX.Element | null {
  if (tags.length === 0) return null;

  return (
    <div
      className="border-border flex shrink-0 flex-wrap gap-1.5 border-b px-3 py-2"
      role="group"
      aria-label="按标签筛选"
    >
      <button
        type="button"
        className={chipClass(value == null)}
        aria-pressed={value == null}
        onClick={() => onChange(null)}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={chipClass(value === tag.id)}
          aria-pressed={value === tag.id}
          onClick={() => onChange(tag.id)}
        >
          {tag.title}
        </button>
      ))}
    </div>
  );
}
