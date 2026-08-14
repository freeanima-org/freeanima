import { useEffect, useMemo, useState, type JSX } from "react";
import { PlusIcon } from "lucide-react";

import { DIARY_ENTRY_COMPONENT } from "@freeanima/shared/entity-shapes";
import { TagChips } from "@freeanima/features/tag/ui/spa/components/TagChips.tsx";
import { TagPicker } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";
import { fetchTags, type TagRow } from "@freeanima/features/tag/ui/spa/lib/api.ts";

export function EntryDetailTagChips({
  tagIds,
  onTagIdsChange,
  readOnly = false,
}: {
  tagIds: number[];
  onTagIdsChange: (tagIds: number[]) => void;
  readOnly?: boolean;
}): JSX.Element | null {
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

  if (readOnly) return <TagChips tagIds={tagIds} titleById={titleById} readOnly />;
  return <TagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />;
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
