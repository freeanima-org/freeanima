import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PlusIcon, TagIcon } from "lucide-react";

import { Button, Input, cn } from "@freeanima/ui-kit";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@freeanima/ui-kit/components/ui/dropdown-menu.tsx";

import {
  createTag,
  fetchTags,
  searchTags,
  suggestTags,
  type TagKnown,
  type TagRow,
  type TagSuggestion,
} from "../lib/api.ts";
import { TagChips } from "./TagChips.tsx";

export type { TagKnown };

type ListRow = {
  id: number;
  title: string;
  count?: number;
};

type TagPickerProps = {
  primaryComponent: string;
  tagIds: number[];
  onChange: (tagIds: number[]) => void;
  mode: "append" | "multi";
  readOnly?: boolean;
  onTagKnown?: (tag: TagKnown) => void;
  /** 仅「添加标签」触发器（chips 另处渲染） */
  triggerOnly?: boolean;
  /** 仅 chips，不含触发器 */
  chipsOnly?: boolean;
  /** 无标签时仍渲染（日记块 hover/触控入口） */
  alwaysShowTrigger?: boolean;
  /** 无标签且未 alwaysShowTrigger 时整组件不渲染（日记块默认） */
  hideWhenEmpty?: boolean;
  triggerClassName?: string;
  align?: "start" | "end";
  triggerLabel?: string;
  triggerIcon?: ReactNode;
};

/** -1 = 输入框；0..itemCount-1 = 候选项；itemCount = 添加按钮（若有） */
export function navTargetCount(itemCount: number, showCreate: boolean): number {
  return itemCount + (showCreate ? 1 : 0);
}

export function moveNavIndex(
  current: number,
  delta: 1 | -1,
  itemCount: number,
  showCreate: boolean,
): number {
  const targets = navTargetCount(itemCount, showCreate);
  if (targets === 0) return -1;
  // 输入框(-1) 与 0..targets-1 组成环形
  const span = targets + 1;
  const from = current < 0 ? -1 : Math.min(current, targets - 1);
  const next = ((((from + 1 + delta) % span) + span) % span) - 1;
  return next;
}

function mergePool(
  prev: TagRow[],
  next: Array<{ id: number; title: string; sort_order?: number }>,
): TagRow[] {
  const map = new Map(prev.map((t) => [t.id, t]));
  for (const row of next) {
    const existing = map.get(row.id);
    map.set(row.id, {
      id: row.id,
      title: row.title,
      sort_order: row.sort_order ?? existing?.sort_order ?? 0,
      created_at: existing?.created_at ?? "",
      updated_at: existing?.updated_at ?? "",
    });
  }
  return [...map.values()].toSorted(
    (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
  );
}

export function TagPicker({
  primaryComponent,
  tagIds,
  onChange,
  mode,
  readOnly = false,
  onTagKnown,
  triggerOnly = false,
  chipsOnly = false,
  alwaysShowTrigger = false,
  hideWhenEmpty = false,
  triggerClassName,
  align = "start",
  triggerLabel,
  triggerIcon,
}: TagPickerProps): JSX.Element | null {
  const [pool, setPool] = useState<TagRow[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** -1 = 输入框；其余见 moveNavIndex */
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(tagIds), [tagIds]);
  const titleById = useMemo(() => new Map(pool.map((t) => [t.id, t.title])), [pool]);
  const hasTags = tagIds.length > 0;
  const q = query.trim();
  const tagIdsKey = tagIds.join(",");

  useEffect(() => {
    let cancelled = false;
    void fetchTags()
      .then((tags) => {
        if (!cancelled) setPool(tags);
      })
      .catch(() => {
        /* chip 无标题时回退 #id */
      });
    return () => {
      cancelled = true;
    };
  }, [tagIdsKey]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const load = q
          ? searchTags(q, { limit: 30 }).then((rows) =>
              rows.map((row): ListRow => ({ id: row.id, title: row.title })),
            )
          : suggestTags(primaryComponent, { limit: 10 }).then((rows: TagSuggestion[]) =>
              rows.map((row): ListRow => ({ id: row.id, title: row.title, count: row.count })),
            );
        void load
          .then((rows) => {
            if (cancelled) return;
            setItems(rows);
            setPool((prev) => mergePool(prev, rows));
          })
          .catch((err) => {
            if (!cancelled) setError(err instanceof Error ? err.message : String(err));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      q ? 200 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, primaryComponent]);

  const showCreate =
    q.length > 0 &&
    !items.some((row) => row.title.toLowerCase() === q.toLowerCase()) &&
    !pool.some((row) => row.title.toLowerCase() === q.toLowerCase());

  const mergedItems: ListRow[] = (() => {
    if (!q) return items;
    const lower = q.toLowerCase();
    const fromPool = pool
      .filter((row) => row.title.toLowerCase().includes(lower))
      .map((row): ListRow => ({ id: row.id, title: row.title }));
    const seen = new Set(items.map((row) => row.id));
    const extras = fromPool.filter((row) => !seen.has(row.id));
    return extras.length > 0 ? [...items, ...extras] : items;
  })();

  const visibleItems =
    mode === "append" ? mergedItems.filter((row) => !selected.has(row.id)) : mergedItems;

  useEffect(() => {
    setActiveIndex(-1);
  }, [open, q, visibleItems.length, showCreate, loading]);

  useEffect(() => {
    if (activeIndex < 0 || !open) return;
    const el = document.querySelector<HTMLElement>(`[data-tag-picker-nav="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function remember(tag: TagKnown): void {
    onTagKnown?.(tag);
    setPool((prev) => mergePool(prev, [tag]));
  }

  function pick(id: number): void {
    if (selected.has(id)) {
      if (mode === "append") setOpen(false);
      return;
    }
    onChange([...tagIds, id]);
    if (mode === "append") {
      setQuery("");
      setOpen(false);
    }
  }

  function toggle(id: number, checked: boolean): void {
    if (checked) {
      if (!tagIds.includes(id)) onChange([...tagIds, id]);
      return;
    }
    onChange(tagIds.filter((x) => x !== id));
  }

  async function createAndPick(title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const item = await createTag(trimmed);
      remember({ id: item.id, title: item.title });
      if (!selected.has(item.id)) onChange([...tagIds, item.id]);
      setQuery("");
      if (mode === "append") setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function remove(tagId: number): void {
    onChange(tagIds.filter((id) => id !== tagId));
  }

  function activateNavTarget(index: number): void {
    if (index < 0) {
      if (showCreate) void createAndPick(q);
      return;
    }
    if (index < visibleItems.length) {
      const row = visibleItems[index];
      if (!row) return;
      if (mode === "append") {
        pick(row.id);
      } else {
        toggle(row.id, !selected.has(row.id));
      }
      return;
    }
    if (showCreate && index === visibleItems.length) {
      void createAndPick(q);
    }
  }

  function onPickerKeyDown(e: KeyboardEvent<HTMLElement>): void {
    const itemCount = loading ? 0 : visibleItems.length;
    const createVisible = !loading && showCreate;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => moveNavIndex(prev, delta, itemCount, createVisible));
      // 焦点留在输入框，避免 Radix 菜单项抢焦点干扰自管高亮
      inputRef.current?.focus();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      activateNavTarget(activeIndex);
      return;
    }

    e.stopPropagation();
  }

  if (chipsOnly) {
    if (readOnly) return <TagChips tagIds={tagIds} titleById={titleById} readOnly />;
    return <TagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />;
  }

  if (readOnly) {
    return hasTags ? <TagChips tagIds={tagIds} titleById={titleById} readOnly /> : null;
  }

  if (hideWhenEmpty && !hasTags && !alwaysShowTrigger) {
    return null;
  }

  const defaultLabel = hasTags && mode === "multi" ? "标签" : "添加标签";
  const label = triggerLabel ?? defaultLabel;
  const createIndex = visibleItems.length;
  /** 不用仅依赖 focus:bg-accent，以免与 Radix 焦点样式混淆 */
  const highlightClass = "bg-accent text-accent-foreground data-[tag-nav-active]:bg-accent";

  const menu = (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setActiveIndex(-1);
        }
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            mode === "multi" ? "text-muted-foreground h-7 gap-1 px-2 text-xs" : undefined,
            triggerClassName,
          )}
          aria-label={label}
        >
          {triggerIcon ??
            (mode === "multi" ? (
              <TagIcon className="size-3.5" />
            ) : (
              <PlusIcon className="size-3.5" />
            ))}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-72 p-2"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onKeyDownCapture={onPickerKeyDown}
      >
        <Input
          ref={inputRef}
          className="h-8"
          value={query}
          placeholder="搜索或新建…"
          aria-label="搜索或新建标签"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onPickerKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
        <p className="text-muted-foreground mt-2 mb-1 px-1 text-[11px] font-medium tracking-wide uppercase">
          {q ? "搜索结果" : "常用标签"}
        </p>
        <div className="max-h-60 overflow-y-auto">
          {error ? <p className="text-destructive px-1 py-1 text-xs">{error}</p> : null}
          {loading ? <p className="text-muted-foreground px-1 py-2 text-xs">加载中…</p> : null}
          {!loading && visibleItems.length === 0 && !showCreate ? (
            <p className="text-muted-foreground px-1 py-2 text-xs">
              {q ? "无匹配标签" : "暂无常用标签，输入以搜索或新建"}
            </p>
          ) : null}
          {!loading && mode === "append"
            ? visibleItems.map((row, index) => (
                <DropdownMenuItem
                  key={row.id}
                  data-tag-picker-nav={index}
                  data-tag-nav-active={activeIndex === index ? "" : undefined}
                  className={cn(activeIndex === index && highlightClass)}
                  onSelect={() => pick(row.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  {row.count != null ? (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {row.count}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))
            : null}
          {!loading && mode === "multi"
            ? visibleItems.map((row, index) => (
                <DropdownMenuCheckboxItem
                  key={row.id}
                  data-tag-picker-nav={index}
                  data-tag-nav-active={activeIndex === index ? "" : undefined}
                  className={cn(activeIndex === index && highlightClass)}
                  checked={selected.has(row.id)}
                  onCheckedChange={(checked) => toggle(row.id, checked === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  {row.count != null ? (
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                      {row.count}
                    </span>
                  ) : null}
                </DropdownMenuCheckboxItem>
              ))
            : null}
          {showCreate ? (
            <>
              {visibleItems.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                data-tag-picker-nav={createIndex}
                data-tag-nav-active={activeIndex === createIndex ? "" : undefined}
                className={cn(
                  "text-foreground gap-2",
                  activeIndex === createIndex && highlightClass,
                )}
                onSelect={() => void createAndPick(q)}
              >
                <PlusIcon className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">添加「{q}」</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (triggerOnly) return menu;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <TagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />
        {menu}
      </div>
      {error && !open ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
