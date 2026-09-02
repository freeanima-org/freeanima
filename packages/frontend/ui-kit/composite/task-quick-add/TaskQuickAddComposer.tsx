import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarIcon, FlagIcon, HashIcon, AtSignIcon, XIcon } from "lucide-react";

import { Button } from "../../components/ui/button.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Popover, PopoverDialog, PopoverTrigger } from "../../components/ui/popover.tsx";
import { ComposerSuggestMenu } from "./ComposerSuggestMenu.tsx";
import { DatePickerInput } from "../../form/DatePickerInput.tsx";
import { cn } from "../../lib/utils.ts";
import { useCompactLayout } from "../../layout/viewport.ts";
import {
  isoToDateLocalValue,
  mergeDateTimeLocal,
  todayDateLocalValue,
} from "../../lib/datetime-local.ts";
import { priorityToneText } from "../../lib/task-item-display.ts";
import { ModalSheetPresent } from "../ModalSheetPresent.tsx";
import { parseQuickAddTitle } from "@freeanima/shared/task/quick-add-parse.ts";

import { buildContainerMenuEntries } from "./build-container-menu.ts";
import {
  parseActiveComposerTrigger,
  removeTriggerSegment,
  type ComposerTrigger,
} from "./composer-trigger.ts";
import {
  dateSlashPresetToStartAt,
  formatPlanDateChipLabel,
  matchDateSlashPresets,
  type DateSlashPreset,
} from "./date-slash-presets.ts";
import {
  composerMenuAriaLabel,
  composerMenuPrimary,
  composerMenuSecondary,
  type ComposerMenuEntry,
} from "./composer-menu-hint.ts";
import {
  matchPriorityEntries,
  priorityChipLabel,
  type PriorityMenuEntry,
} from "./priority-options.ts";
import {
  emptyQuickAddMeta,
  type QuickAddContainer,
  type QuickAddMeta,
  type QuickAddSubmitPayload,
  type QuickAddTagOption,
  type TaskQuickAddComposerProps,
} from "./types.ts";

type MenuEntry =
  | { kind: "container"; key: string; label: string; section: string; data: QuickAddContainer }
  | { kind: "tag"; key: string; label: string; data: QuickAddTagOption }
  | { kind: "priority"; key: string; label: string; data: PriorityMenuEntry }
  | { kind: "dateSlash"; key: string; label: string; data: DateSlashPreset };

function toComposerMenuEntry(entry: MenuEntry): ComposerMenuEntry {
  if (entry.kind === "container") {
    return { kind: "container", key: entry.key, label: entry.label, section: entry.section };
  }
  if (entry.kind === "tag") {
    return { kind: "tag", key: entry.key, label: entry.label };
  }
  if (entry.kind === "priority") {
    return { kind: "priority", key: entry.key, label: entry.label, data: entry.data };
  }
  return { kind: "dateSlash", key: entry.key, label: entry.label, data: entry.data };
}

function mergeStartAt(metaStart: string | null, parsedStart: string | null): string | null {
  return metaStart ?? parsedStart;
}

export function TaskQuickAddComposer({
  lists,
  projects,
  defaultContainer,
  fixedStartDay = null,
  searchTags,
  disabled = false,
  placeholder = "添加任务，可用 @ # ! / 快捷设定",
  className = "border flex shrink-0 flex-col gap-2 border-b p-3",
  submitLabel = "添加",
  enterToSubmit = true,
  hideContainerPicker = false,
  onSubmit,
}: TaskQuickAddComposerProps) {
  const compact = useCompactLayout();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caret, setCaret] = useState(0);
  const [meta, setMeta] = useState<QuickAddMeta>(() => {
    const base = emptyQuickAddMeta(defaultContainer);
    if (fixedStartDay) {
      const startAt = mergeDateTimeLocal(fixedStartDay, "09:00");
      return { ...base, startAt };
    }
    return base;
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tagOptions, setTagOptions] = useState<QuickAddTagOption[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMeta((prev) => {
      const next = { ...prev, container: defaultContainer ?? prev.container };
      if (fixedStartDay) {
        const startAt = mergeDateTimeLocal(fixedStartDay, "09:00");
        return { ...next, startAt };
      }
      return next;
    });
  }, [defaultContainer, fixedStartDay]);

  const trigger = useMemo(
    (): ComposerTrigger | null => parseActiveComposerTrigger(title, caret),
    [title, caret],
  );

  const containerEntries = useMemo(() => {
    if (!trigger || trigger.kind !== "container" || hideContainerPicker) return [];
    return buildContainerMenuEntries(trigger.query, lists, projects).map((row): MenuEntry => ({
      kind: "container",
      key: row.key,
      label: row.label,
      section: row.section,
      data: { kind: row.kind, id: row.id, label: row.label },
    }));
  }, [trigger, lists, projects, hideContainerPicker]);

  const priorityEntries = useMemo((): MenuEntry[] => {
    if (!trigger || trigger.kind !== "priority") return [];
    return matchPriorityEntries(trigger.query).map((row): MenuEntry => ({
      kind: "priority",
      key: row.value,
      label: row.label,
      data: row,
    }));
  }, [trigger]);

  const dateSlashEntries = useMemo((): MenuEntry[] => {
    if (!trigger || trigger.kind !== "dateSlash") return [];
    return matchDateSlashPresets(trigger.query).map((row): MenuEntry => ({
      kind: "dateSlash",
      key: row.id,
      label: row.label,
      data: row,
    }));
  }, [trigger]);

  useEffect(() => {
    if (!trigger || trigger.kind !== "tag") {
      setTagOptions([]);
      setTagLoading(false);
      return () => {};
    }
    let cancelled = false;
    setTagLoading(true);
    const timer = window.setTimeout(() => {
      void searchTags(trigger.query).then((rows) => {
        if (cancelled) return;
        setTagOptions(rows);
        setTagLoading(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trigger, searchTags]);

  const tagEntries = useMemo((): MenuEntry[] => {
    if (!trigger || trigger.kind !== "tag") return [];
    return tagOptions.map((row): MenuEntry => ({
      kind: "tag",
      key: `tag:${row.id}`,
      label: row.title,
      data: row,
    }));
  }, [trigger, tagOptions]);

  const menuEntries = useMemo((): MenuEntry[] => {
    if (!trigger) return [];
    switch (trigger.kind) {
      case "container":
        return containerEntries;
      case "tag":
        return tagEntries;
      case "priority":
        return priorityEntries;
      case "dateSlash":
        return dateSlashEntries;
      default:
        return [];
    }
  }, [trigger, containerEntries, tagEntries, priorityEntries, dateSlashEntries]);

  const showMenu = trigger != null && (trigger.kind !== "container" || !hideContainerPicker);

  const suggestEntries = useMemo(
    () =>
      menuEntries.map((entry) => {
        const view = toComposerMenuEntry(entry);
        return {
          key: entry.key,
          primary: composerMenuPrimary(view),
          secondary: composerMenuSecondary(view),
        };
      }),
    [menuEntries],
  );

  const selectedKey = menuEntries[selectedIdx]?.key ?? null;

  const suggestEmptyLabel = trigger?.kind === "tag" && tagLoading ? "搜索标签…" : "无匹配项";

  useEffect(() => {
    setSelectedIdx((i) => (menuEntries.length === 0 ? 0 : Math.min(i, menuEntries.length - 1)));
  }, [menuEntries.length]);

  const applyMenuSelection = useCallback(
    (entry: MenuEntry) => {
      if (!trigger) return;
      const { next, caret: nextCaret } = removeTriggerSegment(title, trigger.start, caret);
      setTitle(next);
      setCaret(nextCaret);

      if (entry.kind === "container") {
        setMeta((m) => ({ ...m, container: entry.data }));
      } else if (entry.kind === "tag") {
        setMeta((m) => {
          if (m.tagIds.includes(entry.data.id)) return m;
          const tagTitleById = new Map(m.tagTitleById);
          tagTitleById.set(entry.data.id, entry.data.title);
          return { ...m, tagIds: [...m.tagIds, entry.data.id], tagTitleById };
        });
      } else if (entry.kind === "priority") {
        setMeta((m) => ({ ...m, priority: entry.data.value }));
      } else if (entry.kind === "dateSlash") {
        const startAt = dateSlashPresetToStartAt(entry.data.id);
        setMeta((m) => ({ ...m, startAt }));
      }

      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [trigger, title, caret],
  );

  const handleSubmit = async () => {
    const parsed = parseQuickAddTitle(title.trim());
    const finalTitle = parsed.title.trim();
    if (!finalTitle || submitting) return;

    const payload: QuickAddSubmitPayload = {
      title: finalTitle,
      container: meta.container,
      tagIds: meta.tagIds,
      priority: meta.priority ?? "none",
      startAt: mergeStartAt(meta.startAt, parsed.start_at),
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
      setTitle("");
      setCaret(0);
      const fresh = emptyQuickAddMeta(defaultContainer);
      if (fixedStartDay) {
        fresh.startAt = mergeDateTimeLocal(fixedStartDay, "09:00");
      }
      setMeta(fresh);
    } finally {
      setSubmitting(false);
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showMenu && menuEntries.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % menuEntries.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + menuEntries.length) % menuEntries.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const entry = menuEntries[selectedIdx];
        if (entry) applyMenuSelection(entry);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (!trigger) return;
        const { next, caret: nextCaret } = removeTriggerSegment(title, trigger.start, caret);
        setTitle(next);
        setCaret(nextCaret);
        return;
      }
    }
    if (enterToSubmit && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const removeTag = (tagId: number) => {
    setMeta((m) => {
      const tagTitleById = new Map(m.tagTitleById);
      tagTitleById.delete(tagId);
      return { ...m, tagIds: m.tagIds.filter((id) => id !== tagId), tagTitleById };
    });
  };

  const planDateLabel = meta.startAt ? formatPlanDateChipLabel(meta.startAt) : "计划";

  const datePickerBody = (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-muted-foreground text-xs font-medium">计划开始</p>
      <DatePickerInput
        aria-label="计划日期"
        value={meta.startAt ? isoToDateLocalValue(meta.startAt) : todayDateLocalValue()}
        onChange={(nextDate) => {
          if (!nextDate) {
            setMeta((m) => ({ ...m, startAt: null }));
            return;
          }
          setMeta((m) => ({ ...m, startAt: mergeDateTimeLocal(nextDate, "09:00") }));
        }}
      />
      {meta.startAt ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMeta((m) => ({ ...m, startAt: null }))}
        >
          清除日期
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={className}>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {meta.container ? (
          <span className="bg-muted text-foreground inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs">
            <AtSignIcon className="size-3 shrink-0" />
            <span className="truncate">{meta.container.label}</span>
            {!hideContainerPicker ? (
              <button
                type="button"
                className="hover:bg-muted/80 rounded p-0.5"
                aria-label="移除归属"
                onClick={() => setMeta((m) => ({ ...m, container: null }))}
              >
                <XIcon className="size-3 shrink-0" />
              </button>
            ) : null}
          </span>
        ) : null}
        {meta.tagIds.map((tagId) => (
          <span
            key={tagId}
            className="bg-muted text-foreground inline-flex max-w-[8rem] items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs"
          >
            <HashIcon className="size-3 shrink-0" />
            <span className="truncate">{meta.tagTitleById.get(tagId) ?? `#${tagId}`}</span>
            <button
              type="button"
              className="hover:bg-muted/80 rounded p-0.5"
              aria-label="移除标签"
              onClick={() => removeTag(tagId)}
            >
              <XIcon className="size-3 shrink-0" />
            </button>
          </span>
        ))}
        {meta.priority && meta.priority !== "none" ? (
          <button
            type="button"
            className={cn(
              "bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
              priorityToneText(meta.priority),
            )}
            onClick={() => setMeta((m) => ({ ...m, priority: null }))}
          >
            <FlagIcon className="size-3 shrink-0" fill="currentColor" />!
            {priorityChipLabel(meta.priority)}
          </button>
        ) : null}
        {compact ? (
          <>
            <button
              type="button"
              className={cn(
                "bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                meta.startAt ? "text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setDatePickerOpen(true)}
            >
              <CalendarIcon className="size-3 shrink-0" />
              {planDateLabel}
            </button>
            <ModalSheetPresent
              open={datePickerOpen}
              onClose={() => setDatePickerOpen(false)}
              aria-label="计划日期"
            >
              {datePickerBody}
            </ModalSheetPresent>
          </>
        ) : (
          <PopoverTrigger isOpen={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <button
              type="button"
              className={cn(
                "bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                meta.startAt ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <CalendarIcon className="size-3 shrink-0" />
              {planDateLabel}
            </button>
            <Popover placement="bottom start" className="w-auto">
              <PopoverDialog>{datePickerBody}</PopoverDialog>
            </Popover>
          </PopoverTrigger>
        )}
      </div>

      <div className="relative flex min-w-0 gap-2">
        <Input
          ref={inputRef}
          className="min-w-0 flex-1"
          placeholder={placeholder}
          value={title}
          disabled={disabled || submitting}
          onChange={(e) => {
            setTitle(e.target.value);
            const pos = e.target.selectionStart ?? e.target.value.length;
            setCaret(pos);
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            setCaret(el.selectionStart ?? title.length);
          }}
          onKeyDown={onInputKeyDown}
        />
        {showMenu && trigger ? (
          <ComposerSuggestMenu
            open={showMenu}
            triggerRef={inputRef}
            ariaLabel={composerMenuAriaLabel(trigger.kind)}
            entries={suggestEntries}
            selectedKey={selectedKey}
            emptyLabel={suggestEmptyLabel}
            onSelect={(key) => {
              const entry = menuEntries.find((row) => row.key === key);
              if (entry) applyMenuSelection(entry);
            }}
          />
        ) : null}
        <Button
          type="button"
          className="min-h-11 shrink-0"
          isDisabled={disabled || submitting || !title.trim()}
          onClick={() => void handleSubmit()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export type {
  QuickAddContainer,
  QuickAddMeta,
  QuickAddSubmitPayload,
  QuickAddTagOption,
  TaskQuickAddComposerProps,
} from "./types.ts";
