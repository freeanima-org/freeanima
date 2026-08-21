import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, Search, X } from "lucide-react";

import { Button, Input, Spinner, cn } from "@freeanima/ui-kit";
import { EntityIdLabel, ModalSheetPresent } from "@freeanima/ui-kit/composite";

import { fetchEntities, type EntityAdminRow } from "../lib/api.ts";

const DEFAULT_COMPONENT_LABELS: Record<string, string> = {
  project: "项目",
  task_item: "任务",
  task_list: "清单",
  calendar_event: "日程",
  objective: "目标",
  note: "笔记",
  diary_entry: "日记",
  tag: "标签",
};

export type EntityPickerSelection = {
  id: number;
  title: string;
  primary_component: string | null;
  summary: string;
};

type EntityPickerBase = {
  /** 限制可选主组件；多值时可在面板内切换筛选；空=不限 content */
  primaryComponents?: string[];
  /** 列表中隐藏的 id（如编辑时排除自身） */
  excludeIds?: number[];
  componentLabels?: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

type EntityPickerSingleProps = EntityPickerBase & {
  mode: "single";
  value: number | null;
  onChange: (id: number | null, row: EntityPickerSelection | null) => void;
};

type EntityPickerMultiProps = EntityPickerBase & {
  mode: "multi";
  value: number[];
  onChange: (ids: number[], rows: EntityPickerSelection[]) => void;
};

export type EntityPickerProps = EntityPickerSingleProps | EntityPickerMultiProps;

function labelOf(component: string | null | undefined, labels: Record<string, string>): string {
  if (!component) return "实体";
  return labels[component] ?? component;
}

function toSelection(row: EntityAdminRow): EntityPickerSelection {
  return {
    id: row.id,
    title: row.title.trim() || `未命名 #${row.id}`,
    primary_component: row.primary_component,
    summary: row.summary,
  };
}

async function hydrateIds(
  ids: number[],
  cache: Map<number, EntityPickerSelection>,
): Promise<Map<number, EntityPickerSelection>> {
  const next = new Map(cache);
  const missing = ids.filter((id) => !next.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const data = await fetchEntities({ query: String(id), limit: 5 });
        const hit = data.items.find((r: EntityAdminRow) => r.id === id) ?? data.items[0];
        if (hit && hit.id === id) next.set(id, toSelection(hit));
        else next.set(id, { id, title: `#${id}`, primary_component: null, summary: "" });
      } catch {
        next.set(id, { id, title: `#${id}`, primary_component: null, summary: "" });
      }
    }),
  );
  return next;
}

export function EntityPicker(props: EntityPickerProps) {
  const {
    mode,
    primaryComponents,
    excludeIds,
    componentLabels,
    placeholder = "选择实体…",
    disabled = false,
    className,
  } = props;
  const labels = useMemo(
    () => ({ ...DEFAULT_COMPONENT_LABELS, ...componentLabels }),
    [componentLabels],
  );
  const excludeKey = (excludeIds ?? []).join(",");
  const excluded = useMemo(
    () =>
      new Set(
        excludeKey
          .split(",")
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    [excludeKey],
  );

  const selectedIds = mode === "single" ? (props.value != null ? [props.value] : []) : props.value;
  const selectedKey = selectedIds.join(",");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hits, setHits] = useState<EntityAdminRow[]>([]);
  const [componentFilter, setComponentFilter] = useState<string>("");
  const [known, setKnown] = useState<Map<number, EntityPickerSelection>>(() => new Map());

  const allowed = primaryComponents ?? [];
  const multiAllowed = allowed.length > 1;

  useEffect(() => {
    if (allowed.length === 1) {
      const only = allowed[0];
      if (only) setComponentFilter(only);
    } else if (!multiAllowed) {
      setComponentFilter("");
    }
  }, [allowed, multiAllowed]);

  useEffect(() => {
    if (!selectedKey) return undefined;
    const ids = selectedKey
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0);
    let cancelled = false;
    void (async () => {
      const updates = await hydrateIds(ids, new Map());
      if (cancelled) return;
      setKnown((prev) => {
        const next = new Map(prev);
        for (const [id, row] of updates) {
          const cur = next.get(id);
          if (!cur || cur.title === `#${id}`) next.set(id, row);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const primary = componentFilter.trim() || (allowed.length === 1 ? allowed[0] : undefined);
      const data = await fetchEntities({
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(primary ? { primary_component: primary } : {}),
        type: "content",
        limit: 40,
      });
      let items: EntityAdminRow[] = data.items;
      if (!primary && allowed.length > 0) {
        const set = new Set(allowed);
        items = items.filter(
          (r: EntityAdminRow) => r.primary_component != null && set.has(r.primary_component),
        );
      }
      if (excluded.size > 0) {
        items = items.filter((r: EntityAdminRow) => !excluded.has(r.id));
      }
      setHits(items);
      setKnown((prev) => {
        const next = new Map(prev);
        for (const row of items) next.set(row.id, toSelection(row));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, componentFilter, excluded, query]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      void search();
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, query, componentFilter, search]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
    }
  }, [open]);

  function toggle(row: EntityAdminRow) {
    const sel = toSelection(row);
    setKnown((prev) => new Map(prev).set(row.id, sel));
    if (mode === "single") {
      props.onChange(row.id, sel);
      setOpen(false);
      return;
    }
    const exists = props.value.includes(row.id);
    const nextIds = exists ? props.value.filter((id) => id !== row.id) : [...props.value, row.id];
    const nextRows = nextIds
      .map((id) => (id === row.id ? sel : known.get(id)))
      .filter((r): r is EntityPickerSelection => r != null);
    // 补齐未在 known 的项
    const rows: EntityPickerSelection[] = nextIds.map(
      (id) =>
        nextRows.find((r) => r.id === id) ??
        known.get(id) ?? { id, title: `#${id}`, primary_component: null, summary: "" },
    );
    props.onChange(nextIds, rows);
  }

  function clearOne(id: number) {
    if (mode === "single") {
      props.onChange(null, null);
      return;
    }
    const nextIds = props.value.filter((x) => x !== id);
    const rows = nextIds.map(
      (x) => known.get(x) ?? { id: x, title: `#${x}`, primary_component: null, summary: "" },
    );
    props.onChange(nextIds, rows);
  }

  const selectedChips = selectedIds.map((id) => {
    const row = known.get(id);
    return {
      id,
      title: row?.title ?? `#${id}`,
      component: row?.primary_component,
    };
  });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {selectedChips.map((chip) => (
          <span
            key={chip.id}
            className="bg-muted inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs"
          >
            <span className="truncate">{chip.title}</span>
            <EntityIdLabel id={chip.id} />
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`移除 ${chip.title}`}
                onClick={() => clearOne(chip.id)}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          isDisabled={disabled}
          onClick={() => setOpen(true)}
        >
          {placeholder}
        </Button>
      </div>

      <ModalSheetPresent open={open} onClose={() => setOpen(false)} aria-label={placeholder}>
        <div className="border-b px-4 py-3 space-y-2">
          <p className="text-sm font-semibold">{placeholder}</p>
          {multiAllowed ? (
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
            >
              <option value="">全部允许类型</option>
              {allowed.map((c) => (
                <option key={c} value={c}>
                  {labelOf(c, labels)}
                </option>
              ))}
            </select>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-8"
              placeholder="搜索 id / 标题 / 摘要…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
        <ul className="h-[min(50vh,20rem)] overflow-y-auto p-2">
          {loading ? (
            <li className="flex justify-center py-8">
              <Spinner />
            </li>
          ) : hits.length === 0 ? (
            <li className="text-muted-foreground px-3 py-4 text-sm">没有匹配的实体</li>
          ) : (
            hits.map((row) => {
              const selected = selectedIds.includes(row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-muted flex w-full min-h-11 items-start gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      selected && "bg-accent",
                    )}
                    onClick={() => toggle(row)}
                  >
                    <span className="mt-0.5 size-4 shrink-0">
                      {selected ? <CheckIcon className="size-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {row.title.trim() || `未命名 #${row.id}`}
                        </span>
                        <EntityIdLabel id={row.id} />
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {labelOf(row.primary_component, labels)}
                        {row.summary ? ` · ${row.summary}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t p-2">
          <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            {mode === "multi" ? "完成" : "取消"}
          </Button>
        </div>
      </ModalSheetPresent>
    </div>
  );
}
