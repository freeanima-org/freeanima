import { useEffect, useMemo, useState, type JSX } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Button, Input } from "@freeanima/frontend/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@freeanima/frontend/ui-kit/components/ui/dropdown-menu.tsx";
import { createTag, fetchTags, type TagRow } from "@freeanima/features/tag/ui/spa/lib/api.ts";

import { suggestDiaryTags, type DiarySubjectKind } from "../lib/api.ts";

type EntryTagHeaderProps = {
  subjectKind: DiarySubjectKind;
  tagIds: number[];
  onTagIdsChange: (tagIds: number[]) => void;
  readOnly?: boolean;
  /** 仅 chips，不含「添加标签」按钮（按钮放在 detailActions） */
  chipsOnly?: boolean;
  /** 仅「添加标签」下拉（chips 另处渲染） */
  triggerOnly?: boolean;
};

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

export function EntryTagAddMenu({
  subjectKind,
  tagIds,
  onTagIdsChange,
  readOnly = false,
  onTagCreated,
}: {
  subjectKind: DiarySubjectKind;
  tagIds: number[];
  onTagIdsChange: (tagIds: number[]) => void;
  readOnly?: boolean;
  onTagCreated?: (tag: TagRow) => void;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ id: number; title: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => new Set(tagIds), [tagIds]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        void suggestDiaryTags(subjectKind, {
          ...(query.trim() ? { query: query.trim() } : {}),
          limit: 10,
        })
          .then((rows) => {
            if (!cancelled) setItems(rows);
          })
          .catch((err) => {
            if (!cancelled) setError(err instanceof Error ? err.message : String(err));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query.trim() ? 200 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, subjectKind]);

  if (readOnly) return null;

  function pick(id: number): void {
    if (selected.has(id)) {
      setOpen(false);
      return;
    }
    onTagIdsChange([...tagIds, id]);
    setQuery("");
    setOpen(false);
  }

  async function createAndPick(title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const item = await createTag(trimmed);
      onTagCreated?.(item);
      if (!selected.has(item.id)) onTagIdsChange([...tagIds, item.id]);
      setQuery("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const q = query.trim();
  const showCreate =
    q.length > 0 &&
    !items.some((row) => row.title.toLowerCase() === q.toLowerCase()) &&
    ![...selected].some((id) => items.some((row) => row.id === id && row.title === q));

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <PlusIcon className="size-3.5" />
          添加标签
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="px-1">
          {q ? "搜索日记标签" : "常用日记标签"}
        </DropdownMenuLabel>
        <Input
          className="mb-2 h-8"
          value={query}
          placeholder="搜索…"
          aria-label="搜索日记标签"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCreate) {
              e.preventDefault();
              void createAndPick(q);
            }
          }}
        />
        <DropdownMenuSeparator />
        {error ? <p className="text-destructive px-1 py-1 text-xs">{error}</p> : null}
        {loading ? <p className="text-muted-foreground px-1 py-2 text-xs">加载中…</p> : null}
        {!loading && items.length === 0 && !showCreate ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">暂无常用标签</p>
        ) : null}
        {!loading
          ? items
              .filter((row) => !selected.has(row.id))
              .map((row) => (
                <DropdownMenuItem key={row.id} onSelect={() => pick(row.id)}>
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{row.count}</span>
                </DropdownMenuItem>
              ))
          : null}
        {showCreate ? (
          <>
            {items.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => void createAndPick(q)}>添加「{q}」</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 兼容聚合：chips + 可选 trigger；DiaryApp 通常拆开用 */
export function EntryTagHeader({
  subjectKind,
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
        subjectKind={subjectKind}
        tagIds={tagIds}
        onTagIdsChange={onTagIdsChange}
        readOnly={readOnly}
        onTagCreated={(tag) =>
          setPool((prev) =>
            prev.some((t) => t.id === tag.id)
              ? prev
              : [...prev, tag].toSorted(
                  (a, b) =>
                    a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
                ),
          )
        }
      />
    );
  }

  if (chipsOnly) {
    if (readOnly) return <EntryTagChips tagIds={tagIds} titleById={titleById} readOnly />;
    return <EntryTagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {readOnly ? (
        <EntryTagChips tagIds={tagIds} titleById={titleById} readOnly />
      ) : (
        <EntryTagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />
      )}
      <EntryTagAddMenu
        subjectKind={subjectKind}
        tagIds={tagIds}
        onTagIdsChange={onTagIdsChange}
        readOnly={readOnly}
        onTagCreated={(tag) =>
          setPool((prev) =>
            prev.some((t) => t.id === tag.id)
              ? prev
              : [...prev, tag].toSorted(
                  (a, b) =>
                    a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
                ),
          )
        }
      />
    </div>
  );
}
