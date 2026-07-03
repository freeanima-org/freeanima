import type { DiaryEntryRow } from "../lib/format-diary.ts";
import { EmptyState } from "@freeanima/ui-kit/composite";
import {
  dateLocalToEntryAtIso,
  defaultEntryDateLocal,
  entryDayKey,
  formatEntryDate,
  isoToDateLocalValue,
} from "../lib/format-diary.ts";

type DayGroup = { label: string; item: DiaryEntryRow };

function contentPreview(content: string): string {
  const line = content
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? "（空）";
}

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

export function EntryTimeline({
  items,
  selectedId,
  onSelect,
}: {
  items: DiaryEntryRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const groups = groupEntriesByDate(items);
  if (groups.length === 0) {
    return <EmptyState message="暂无日记条目" className="px-2 text-left items-start" />;
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
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
          <div className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
            {contentPreview(group.item.content)}
          </div>
        </button>
      ))}
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
