import { useEffect, useMemo, useState, type JSX } from "react";
import { PlusIcon } from "lucide-react";

import { DIARY_ENTRY_COMPONENT } from "@freeanima/core/db/schema";
import { TagChips } from "@freeanima/features/tag/ui/spa/components/TagChips.tsx";
import { TagPicker } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";
import { fetchTags, type TagRow } from "@freeanima/features/tag/ui/spa/lib/api.ts";

type EntryTagHeaderProps = {
  subjectKind: "user" | "agent";
  tagIds: number[];
  onTagIdsChange: (tagIds: number[]) => void;
  readOnly?: boolean;
  /** 仅 chips，不含「添加标签」按钮（按钮放在 detailActions） */
  chipsOnly?: boolean;
  /** 仅「添加标签」下拉（chips 另处渲染） */
  triggerOnly?: boolean;
};

/** @deprecated 请优先用 TagChips；保留兼容 DiaryApp */
export function EntryTagChips({
  tagIds,
  titleById,
  readOnly = false,
  onRemove,
}: {
  tagIds: number[];
  titleById: Map<number, string>;
  readOnly?: boolean;
  onRemove?: (tagId: number) => void;
}): JSX.Element | null {
  return (
    <TagChips
      tagIds={tagIds}
      titleById={titleById}
      readOnly={readOnly}
      {...(onRemove ? { onRemove } : {})}
    />
  );
}

export function EntryTagAddMenu({
  tagIds,
  onTagIdsChange,
  readOnly = false,
  onTagCreated,
}: {
  subjectKind?: "user" | "agent";
  tagIds: number[];
  onTagIdsChange: (tagIds: number[]) => void;
  readOnly?: boolean;
  onTagCreated?: (tag: TagRow) => void;
}): JSX.Element | null {
  if (readOnly) return null;
  return (
    <TagPicker
      primaryComponent={DIARY_ENTRY_COMPONENT}
      tagIds={tagIds}
      onChange={onTagIdsChange}
      mode="append"
      triggerOnly
      align="end"
      triggerIcon={<PlusIcon className="size-3.5" />}
      triggerLabel="添加标签"
      {...(onTagCreated
        ? {
            onTagKnown: (tag) =>
              onTagCreated({ ...tag, sort_order: 0, created_at: "", updated_at: "" }),
          }
        : {})}
    />
  );
}

/** 兼容聚合：chips + 可选 trigger；DiaryApp 通常拆开用 */
export function EntryTagHeader({
  tagIds,
  onTagIdsChange,
  readOnly = false,
  chipsOnly = false,
  triggerOnly = false,
}: EntryTagHeaderProps): JSX.Element | null {
  const [pool, setPool] = useState<TagRow[]>([]);

  const tagIdsKey = tagIds.join(",");
  useEffect(() => {
    let cancelled = false;
    void fetchTags()
      .then((tags) => {
        if (!cancelled) setPool(tags);
      })
      .catch(() => {
        /* 侧栏/顶栏无标题时回退 #id */
      });
    return () => {
      cancelled = true;
    };
  }, [tagIdsKey]);

  const titleById = useMemo(() => new Map(pool.map((t) => [t.id, t.title])), [pool]);

  const remove = (tagId: number) => {
    onTagIdsChange(tagIds.filter((id) => id !== tagId));
  };

  if (triggerOnly) {
    return (
      <EntryTagAddMenu
        tagIds={tagIds}
        onTagIdsChange={onTagIdsChange}
        readOnly={readOnly}
        onTagCreated={(tag) => setPool((prev) => mergeKnown(prev, tag))}
      />
    );
  }

  if (chipsOnly) {
    if (readOnly) return <TagChips tagIds={tagIds} titleById={titleById} readOnly />;
    return <TagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />;
  }

  return (
    <TagPicker
      primaryComponent={DIARY_ENTRY_COMPONENT}
      tagIds={tagIds}
      onChange={onTagIdsChange}
      mode="append"
      readOnly={readOnly}
      align="end"
      onTagKnown={(tag) =>
        setPool((prev) =>
          mergeKnown(prev, { ...tag, sort_order: 0, created_at: "", updated_at: "" }),
        )
      }
    />
  );
}

function mergeKnown(prev: TagRow[], tag: TagRow): TagRow[] {
  if (prev.some((t) => t.id === tag.id)) return prev;
  return [...prev, tag].toSorted(
    (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
  );
}
