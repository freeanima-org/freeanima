import { useEffect, useRef } from "react";
import type { DiaryEntryRow } from "../lib/format-diary.ts";
import { EmptyState } from "@freeanima/frontend/ui-kit/composite";
import { Spinner } from "@freeanima/frontend/ui-kit";
import {
  dateLocalToEntryAtIso,
  defaultEntryDateLocal,
  entryDayKey,
  formatEntryDate,
  isoToDateLocalValue,
} from "../lib/format-diary.ts";

type DayGroup = { label: string; item: DiaryEntryRow };

function groupLabel(dayKey: string): string {
  const today = defaultEntryDateLocal();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = isoToDateLocalValue(yesterdayDate.toISOString());
  if (dayKey === today) return "今天";
  if (dayKey === yesterday) return "昨天";
  return formatEntryDate(dateLocalToEntryAtIso(dayKey));
}

/** 同一天只保留最新一条（兼容历史重复数据） */
export function groupEntriesByDate(items: DiaryEntryRow[]): DayGroup[] {
  const map = new Map<string, DiaryEntryRow>();
  for (const item of items) {
    const key = entryDayKey(item.entry_at);
    const prev = map.get(key);
    if (!prev || item.id > prev.id) map.set(key, item);
  }
  return [...map.entries()]
    .map(([dayKey, item]) => ({
      label: groupLabel(dayKey),
      item,
    }))
    .toSorted((a, b) => b.item.entry_at.localeCompare(a.item.entry_at));
}

function EntryTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <div className="text-sm text-muted-foreground/70 mt-1 truncate">（无标签）</div>;
  }
  return (
    <div className="mt-1 flex min-w-0 flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-muted text-muted-foreground max-w-full truncate rounded px-1.5 py-0.5 text-xs"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function EntryTimeline({
  items,
  selectedId,
  onSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  items: DiaryEntryRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (loadingMore) return;
        onLoadMoreRef.current?.();
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, items.length, onLoadMore]);

  const groups = groupEntriesByDate(items);
  if (groups.length === 0) {
    return <EmptyState message="暂无日记条目" className="px-2 text-left items-start" />;
  }

  return (
    <div ref={scrollRef} className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto">
      {groups.map((group) => (
        <button
          key={group.item.id}
          type="button"
          className={`min-w-0 w-full overflow-hidden text-left rounded-lg px-3 py-2.5 transition-colors ${
            selectedId === group.item.id
              ? "bg-primary/15 ring-1 ring-primary/30"
              : "hover:bg-muted/80"
          }`}
          onClick={() => onSelect(group.item.id)}
        >
          <div className="text-xs font-semibold text-muted-foreground truncate">{group.label}</div>
          <EntryTags tags={group.item.tags} />
        </button>
      ))}
      {hasMore ? (
        <div ref={sentinelRef} className="flex shrink-0 items-center justify-center py-2">
          {loadingMore ? (
            <Spinner className="size-3.5" />
          ) : (
            <span className="h-1 w-1" aria-hidden />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function findEntryByDayLocal(
  items: DiaryEntryRow[],
  dateLocal: string,
): DiaryEntryRow | undefined {
  const day = dateLocal.trim();
  return items.find((item) => entryDayKey(item.entry_at) === day);
}
