import type { JSX } from "react";
import { XIcon } from "lucide-react";

type TagChipsProps = {
  tagIds: number[];
  titleById: Map<number, string>;
  readOnly?: boolean;
  onRemove?: (tagId: number) => void;
};

export function TagChips({
  tagIds,
  titleById,
  readOnly = false,
  onRemove,
}: TagChipsProps): JSX.Element | null {
  if (tagIds.length === 0) return null;
  const canRemove = !readOnly && onRemove != null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {tagIds.map((id) => {
        const title = titleById.get(id) ?? `#${id}`;
        return !canRemove ? (
          <span
            key={id}
            className="bg-muted text-muted-foreground inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs"
          >
            {title}
          </span>
        ) : (
          <button
            key={id}
            type="button"
            className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs"
            onClick={() => onRemove(id)}
            aria-label={`移除标签 ${title}`}
          >
            <span className="truncate">{title}</span>
            <XIcon className="size-3 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
