import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { CheckIcon, PlusIcon, TagIcon } from "lucide-react";

import { Button, Input, cn } from "@freeanima/ui-kit";
import { ModalSheetPresent } from "@freeanima/ui-kit/composite";
import {
  Popover,
  PopoverDialog,
  PopoverTrigger,
} from "@freeanima/ui-kit/components/ui/popover.tsx";
import { useCompactLayout } from "@freeanima/ui-kit/layout";

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

function TagPickerBody({
  query,
  onQueryChange,
  q,
  loading,
  error,
  visibleItems,
  showCreate,
  mode,
  selected,
  activeIndex,
  createIndex,
  highlightClass,
  inputRef,
  onPickerKeyDown,
  onPick,
  onToggle,
  onCreate,
  /** Sheet 内展示标题与取消；Popover 内省略 */
  sheetChrome,
  onClose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  q: string;
  loading: boolean;
  error: string | null;
  visibleItems: ListRow[];
  showCreate: boolean;
  mode: "append" | "multi";
  selected: Set<number>;
  activeIndex: number;
  createIndex: number;
  highlightClass: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onPickerKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onPick: (id: number) => void;
  onToggle: (id: number, checked: boolean) => void;
  onCreate: (title: string) => void;
  sheetChrome?: boolean;
  onClose?: () => void;
}): JSX.Element {
  const searchField = (
    <div onKeyDownCapture={onPickerKeyDown}>
      <Input
        ref={inputRef}
        className={cn("h-8", sheetChrome && "w-full")}
        value={query}
        placeholder="搜索或新建…"
        aria-label="搜索或新建标签"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onPickerKeyDown}
      />
      <p className="text-muted-foreground mt-2 mb-1 px-1 text-[11px] font-medium tracking-wide uppercase">
        {q ? "搜索结果" : "常用标签"}
      </p>
    </div>
  );

  const list = (
    <div
      className={cn(
        "overflow-y-auto",
        // 固定高度：搜索结果数量变化时不抖动外壳
        sheetChrome ? "h-[min(50vh,20rem)] px-2 pb-2" : "h-60",
      )}
    >
      {error ? <p className="text-destructive px-1 py-1 text-xs">{error}</p> : null}
      {loading ? <p className="text-muted-foreground px-1 py-2 text-xs">加载中…</p> : null}
      {!loading && visibleItems.length === 0 && !showCreate ? (
        <p className="text-muted-foreground px-1 py-2 text-xs">
          {q ? "无匹配标签" : "暂无常用标签，输入以搜索或新建"}
        </p>
      ) : null}
      {!loading
        ? visibleItems.map((row, index) => {
            const isSelected = selected.has(row.id);
            return (
              <button
                key={row.id}
                type="button"
                data-tag-picker-nav={index}
                data-tag-nav-active={activeIndex === index ? "" : undefined}
                className={cn(
                  "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none",
                  sheetChrome && "min-h-11",
                  activeIndex === index && highlightClass,
                )}
                onClick={() => {
                  if (mode === "append") onPick(row.id);
                  else onToggle(row.id, !isSelected);
                }}
              >
                {mode === "multi" ? (
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden
                  >
                    {isSelected ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{row.title}</span>
                {row.count != null ? (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {row.count}
                  </span>
                ) : null}
              </button>
            );
          })
        : null}
      {showCreate ? (
        <>
          {visibleItems.length > 0 ? (
            <div className="bg-border my-1 h-px" role="separator" />
          ) : null}
          <button
            type="button"
            data-tag-picker-nav={createIndex}
            data-tag-nav-active={activeIndex === createIndex ? "" : undefined}
            className={cn(
              "hover:bg-muted text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none",
              sheetChrome && "min-h-11",
              activeIndex === createIndex && highlightClass,
            )}
            onClick={() => onCreate(q)}
          >
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">添加「{q}」</span>
          </button>
        </>
      ) : null}
    </div>
  );

  if (!sheetChrome) {
    return (
      <>
        {searchField}
        {list}
      </>
    );
  }

  return (
    <>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">添加标签</p>
        <div className="mt-2">{searchField}</div>
      </div>
      {list}
      <div className="border-t p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            onClose?.();
          }}
        >
          取消
        </Button>
      </div>
    </>
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
  const compact = useCompactLayout();
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

  function closePicker(): void {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function handleOpenChange(next: boolean): void {
    if (next) {
      setOpen(true);
      return;
    }
    closePicker();
  }

  function pick(id: number): void {
    if (selected.has(id)) {
      if (mode === "append") closePicker();
      return;
    }
    onChange([...tagIds, id]);
    if (mode === "append") {
      setQuery("");
      closePicker();
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
      if (mode === "append") closePicker();
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
      // 焦点留在输入框，避免列表项抢焦点干扰自管高亮
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
  /** 不用仅依赖 focus:bg-accent，以免与焦点样式混淆 */
  const highlightClass = "bg-accent text-accent-foreground data-[tag-nav-active]:bg-accent";
  const placement = align === "end" ? "bottom end" : "bottom start";

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        mode === "multi" ? "text-muted-foreground h-7 gap-1 px-2 text-xs" : undefined,
        triggerClassName,
      )}
      aria-label={label}
      {...(compact
        ? {
            onClick: () => setOpen(true),
          }
        : {})}
    >
      {triggerIcon ??
        (mode === "multi" ? <TagIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />)}
      {label}
    </Button>
  );

  const body = (
    <TagPickerBody
      query={query}
      onQueryChange={setQuery}
      q={q}
      loading={loading}
      error={error}
      visibleItems={visibleItems}
      showCreate={showCreate}
      mode={mode}
      selected={selected}
      activeIndex={activeIndex}
      createIndex={createIndex}
      highlightClass={highlightClass}
      inputRef={inputRef}
      onPickerKeyDown={onPickerKeyDown}
      onPick={pick}
      onToggle={toggle}
      onCreate={(title) => void createAndPick(title)}
      sheetChrome={compact}
      onClose={closePicker}
    />
  );

  // Menu 只渲染 MenuItem；含 Input/自定义列表须用 Popover（expanded）或 ModalSheetPresent（compact）
  const picker = compact ? (
    <>
      {triggerButton}
      <ModalSheetPresent open={open} onClose={closePicker} aria-label={label}>
        {body}
      </ModalSheetPresent>
    </>
  ) : (
    <PopoverTrigger isOpen={open} onOpenChange={handleOpenChange}>
      {triggerButton}
      <Popover placement={placement} className="w-72 p-2">
        <PopoverDialog>{body}</PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );

  if (triggerOnly) return picker;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <TagChips tagIds={tagIds} titleById={titleById} onRemove={remove} />
        {picker}
      </div>
      {error && !open ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
