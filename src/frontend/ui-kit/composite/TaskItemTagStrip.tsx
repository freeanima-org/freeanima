import {
  splitTaskTagTitlesForDisplay,
  TASK_ROW_TAG_MAX_VISIBLE,
} from "../lib/task-item-display.ts";

export type TaskItemTagStripProps = {
  titles: readonly string[];
  /** 默认 {@link TASK_ROW_TAG_MAX_VISIBLE} */
  maxVisible?: number;
  className?: string;
};

/**
 * 任务行只读标签条：限宽 truncate + 超出以 +N 收纳，避免撑破行布局。
 */
export function TaskItemTagStrip({
  titles,
  maxVisible = TASK_ROW_TAG_MAX_VISIBLE,
  className = "",
}: TaskItemTagStripProps) {
  if (titles.length === 0) return null;

  const { visible, overflowCount } = splitTaskTagTitlesForDisplay(titles, maxVisible);
  const allLabel = titles.join("、");

  return (
    <span
      className={["mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      title={allLabel}
      aria-label={`标签：${allLabel}`}
    >
      {visible.map((title, index) => (
        <span
          key={`${index}:${title}`}
          className="bg-muted text-muted-foreground inline-flex max-w-[5.5rem] shrink-0 items-center rounded px-1.5 py-px text-[10px] leading-4"
        >
          <span className="truncate">{title}</span>
        </span>
      ))}
      {overflowCount > 0 ? (
        <span className="text-muted-foreground shrink-0 text-[10px] leading-4">
          +{overflowCount}
        </span>
      ) : null}
    </span>
  );
}
