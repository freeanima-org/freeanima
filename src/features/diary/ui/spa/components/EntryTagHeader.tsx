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

import { suggestDiaryTags, type DiarySubjectKind } from "../lib/api.ts";
import { parseTagsText } from "../lib/entry-draft-dirty.ts";

type EntryTagHeaderProps = {
  subjectKind: DiarySubjectKind;
  tagsText: string;
  onTagsTextChange: (tagsText: string) => void;
  readOnly?: boolean;
  /** 仅 chips，不含「添加标签」按钮（按钮放在 detailActions） */
  chipsOnly?: boolean;
  /** 仅「添加标签」下拉（chips 另处渲染） */
  triggerOnly?: boolean;
};

function tagsFromText(tagsText: string): string[] {
  return parseTagsText(tagsText);
}

function toTagsText(tags: string[]): string {
  return tags.join(", ");
}

export function EntryTagChips({
  tags,
  readOnly = false,
  onRemove,
}: {
  tags: string[];
  readOnly?: boolean;
  onRemove?: (tag: string) => void;
}): JSX.Element | null {
  if (tags.length === 0) return null;
  const canRemove = !readOnly && onRemove != null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {tags.map((tag) =>
        !canRemove ? (
          <span
            key={tag}
            className="bg-muted text-muted-foreground inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs"
          >
            {tag}
          </span>
        ) : (
          <button
            key={tag}
            type="button"
            className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs"
            onClick={() => onRemove(tag)}
            aria-label={`移除标签 ${tag}`}
          >
            <span className="truncate">{tag}</span>
            <XIcon className="size-3 shrink-0" />
          </button>
        ),
      )}
    </div>
  );
}

export function EntryTagAddMenu({
  subjectKind,
  tagsText,
  onTagsTextChange,
  readOnly = false,
}: {
  subjectKind: DiarySubjectKind;
  tagsText: string;
  onTagsTextChange: (tagsText: string) => void;
  readOnly?: boolean;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => new Set(tagsFromText(tagsText)), [tagsText]);

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

  function pick(tag: string): void {
    const trimmed = tag.trim();
    if (!trimmed || selected.has(trimmed)) {
      setOpen(false);
      return;
    }
    onTagsTextChange(toTagsText([...tagsFromText(tagsText), trimmed]));
    setQuery("");
    setOpen(false);
  }

  const q = query.trim();
  const showCreate =
    q.length > 0 &&
    !selected.has(q) &&
    !items.some((row) => row.tag.toLowerCase() === q.toLowerCase());

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
              pick(q);
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
              .filter((row) => !selected.has(row.tag))
              .map((row) => (
                <DropdownMenuItem key={row.tag} onSelect={() => pick(row.tag)}>
                  <span className="min-w-0 flex-1 truncate">{row.tag}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{row.count}</span>
                </DropdownMenuItem>
              ))
          : null}
        {showCreate ? (
          <>
            {items.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => pick(q)}>添加「{q}」</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 兼容聚合：chips + 可选 trigger；DiaryApp 通常拆开用 */
export function EntryTagHeader({
  subjectKind,
  tagsText,
  onTagsTextChange,
  readOnly = false,
  chipsOnly = false,
  triggerOnly = false,
}: EntryTagHeaderProps): JSX.Element | null {
  const tags = tagsFromText(tagsText);
  const remove = (tag: string) => {
    onTagsTextChange(toTagsText(tags.filter((t) => t !== tag)));
  };

  if (triggerOnly) {
    return (
      <EntryTagAddMenu
        subjectKind={subjectKind}
        tagsText={tagsText}
        onTagsTextChange={onTagsTextChange}
        readOnly={readOnly}
      />
    );
  }

  if (chipsOnly) {
    if (readOnly) return <EntryTagChips tags={tags} readOnly />;
    return <EntryTagChips tags={tags} onRemove={remove} />;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {readOnly ? (
        <EntryTagChips tags={tags} readOnly />
      ) : (
        <EntryTagChips tags={tags} onRemove={remove} />
      )}
      <EntryTagAddMenu
        subjectKind={subjectKind}
        tagsText={tagsText}
        onTagsTextChange={onTagsTextChange}
        readOnly={readOnly}
      />
    </div>
  );
}
