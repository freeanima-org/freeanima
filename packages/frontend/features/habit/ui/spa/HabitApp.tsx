import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Check,
  Circle,
  Library,
  Plus,
  Repeat,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useActionSheetCapability, useUserSubjectId } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import { EmptyState, ListRow, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";
import { useCompactLayout } from "@freeanima/ui-kit/layout";

import {
  DAY_SECTION_LABEL,
  POLARITY_LABEL,
  RECORD_MODE_LABEL,
  archiveHabitRemote,
  checkInHabitRemote,
  createHabitRemote,
  deleteHabitRemote,
  fetchHabitPresets,
  fetchHabitStats,
  fetchHabits,
  patchHabitRemote,
  unarchiveHabitRemote,
  undoCheckInRemote,
  type HabitPreset,
  type HabitRow,
  type HabitStats,
} from "./lib/api.ts";

type ViewMode = "active" | "archived" | "presets" | "stats";

type Draft = {
  title: string;
  content: string;
  polarity: HabitRow["polarity"];
  record_mode: HabitRow["record_mode"];
  target: string;
  unit: string;
  auto_amount: string;
  day_section: HabitRow["day_section"];
  reminders: string;
  enable_journal: boolean;
  check_in_style: HabitRow["check_in_style"];
};

const SECTIONS: HabitRow["day_section"][] = ["morning", "afternoon", "evening", "other"];

function emptyDraft(): Draft {
  return {
    title: "",
    content: "",
    polarity: "build",
    record_mode: "boolean",
    target: "1",
    unit: "",
    auto_amount: "1",
    day_section: "other",
    reminders: "",
    enable_journal: true,
    check_in_style: "check",
  };
}

function draftFromHabit(h: HabitRow): Draft {
  return {
    title: h.title,
    content: h.content,
    polarity: h.polarity,
    record_mode: h.record_mode,
    target: String(h.target),
    unit: h.unit ?? "",
    auto_amount: String(h.auto_amount ?? 1),
    day_section: h.day_section,
    reminders: (h.reminders ?? []).map((r) => r.time).join(", "),
    enable_journal: h.enable_journal,
    check_in_style: h.check_in_style,
  };
}

function parseReminders(raw: string): { time: string }[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    .map((time) => ({ time }));
}

function progressLabel(h: HabitRow): string {
  const amount = h.today_amount ?? 0;
  if (h.polarity === "break") {
    if (h.record_mode === "boolean") return h.today_met ? "未超限" : "已超限";
    const unit = h.unit ? ` ${h.unit}` : "";
    return `${amount}/${h.target}${unit}${h.today_met ? " · 未超限" : " · 已超限"}`;
  }
  if (h.record_mode === "boolean") return h.today_met ? "已完成" : "未完成";
  const unit = h.unit ? ` ${h.unit}` : "";
  return `${amount}/${h.target}${unit}`;
}

function progressLabelClass(h: HabitRow): string {
  if (h.polarity === "break" && !h.today_met) return "text-destructive text-xs";
  if (h.polarity === "build" && h.today_met) return "text-primary text-xs";
  return "text-muted-foreground text-xs";
}

function checkInActionLabel(polarity: HabitRow["polarity"]): string {
  return polarity === "break" ? "记一次" : "打卡";
}

function amountDeltaPlaceholder(polarity: HabitRow["polarity"]): string {
  return polarity === "break" ? "本次发生量" : "本次完成量";
}

/** 列表快捷按钮：养成完成=实心勾；戒除超限=警示；否则待操作 */
function listCheckInButtonProps(h: HabitRow): {
  variant: "default" | "outline" | "destructive";
  label: string;
  icon: "check" | "circle" | "plus" | "alert";
} {
  if (h.polarity === "break") {
    if (h.today_met) {
      return { variant: "outline", label: "记一次", icon: "plus" };
    }
    return { variant: "destructive", label: "已超限，仍可记", icon: "alert" };
  }
  if (h.today_met) {
    return { variant: "default", label: "已完成，再打卡", icon: "check" };
  }
  return { variant: "outline", label: "打卡", icon: "circle" };
}

export function HabitApp() {
  const subjectId = useUserSubjectId();
  const compact = useCompactLayout();
  const useActionSheet = useActionSheetCapability();
  const [view, setView] = useState<ViewMode>("active");
  const [items, setItems] = useState<HabitRow[]>([]);
  const [presets, setPresets] = useState<HabitPreset[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [manualDelta, setManualDelta] = useState("1");
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => items.find((h) => h.id === selectedId) ?? null,
    [items, selectedId],
  );

  const grouped = useMemo(() => {
    const map = new Map<HabitRow["day_section"], HabitRow[]>();
    for (const s of SECTIONS) map.set(s, []);
    for (const h of items) {
      const list = map.get(h.day_section) ?? [];
      list.push(h);
      map.set(h.day_section, list);
    }
    return map;
  }, [items]);

  const reload = useCallback(async () => {
    if (subjectId == null) return;
    setLoading(true);
    setError(null);
    try {
      if (view === "presets") {
        setPresets(await fetchHabitPresets(subjectId));
      } else {
        const status = view === "archived" ? "archived" : "active";
        const list = await fetchHabits(subjectId, { status, include_today: true });
        setItems(list);
        if (selectedId != null && !list.some((h) => h.id === selectedId)) {
          setSelectedId(list[0]?.id ?? null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectId, view, selectedId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    if (subjectId == null || selectedId == null || view === "presets") {
      setStats(null);
    } else {
      void (async () => {
        try {
          const s = await fetchHabitStats(subjectId, selectedId);
          if (!cancelled) setStats(s);
        } catch {
          if (!cancelled) setStats(null);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [subjectId, selectedId, view, items]);

  const onCheckIn = async (habit: HabitRow) => {
    if (subjectId == null) return;
    try {
      const delta = habit.record_mode === "manual" ? Number(manualDelta) || 0 : null;
      const result = await checkInHabitRemote(subjectId, {
        habit_id: habit.id,
        ...(delta != null && delta !== 0 ? { amount_delta: delta } : {}),
        ...(habit.enable_journal && note.trim() ? { note: note.trim() } : {}),
      });
      setItems((prev) => prev.map((h) => (h.id === result.habit.id ? result.habit : h)));
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onUndo = async (habit: HabitRow) => {
    if (subjectId == null) return;
    try {
      const result = await undoCheckInRemote(subjectId, { habit_id: habit.id });
      setItems((prev) => prev.map((h) => (h.id === result.habit.id ? result.habit : h)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveDraft = async () => {
    if (subjectId == null || !draft.title.trim()) return;
    const polarity = draft.polarity;
    const record_mode = draft.record_mode;
    const target =
      record_mode === "boolean"
        ? polarity === "break"
          ? 0
          : 1
        : Number(draft.target) || (polarity === "break" ? 0 : 1);
    const payload = {
      title: draft.title.trim(),
      content: draft.content,
      polarity,
      record_mode,
      target,
      unit: draft.unit.trim() || null,
      auto_amount: record_mode === "auto" ? Number(draft.auto_amount) || 1 : null,
      day_section: draft.day_section,
      reminders: parseReminders(draft.reminders),
      enable_journal: draft.enable_journal,
      check_in_style: draft.check_in_style,
    };
    try {
      if (creating) {
        const item = await createHabitRemote(subjectId, payload);
        setCreating(false);
        setEditing(false);
        setView("active");
        await reload();
        setSelectedId(item.id);
      } else if (selected) {
        const item = await patchHabitRemote(subjectId, selected.id, payload);
        setEditing(false);
        setItems((prev) => prev.map((h) => (h.id === item.id ? { ...h, ...item } : h)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createFromPreset = async (p: HabitPreset) => {
    if (subjectId == null) return;
    try {
      const item = await createHabitRemote(subjectId, {
        title: p.title,
        polarity: p.polarity,
        record_mode: p.record_mode,
        target: p.target,
        unit: p.unit,
        auto_amount: p.auto_amount,
        day_section: p.day_section,
        icon: p.icon,
      });
      setView("active");
      await reload();
      setSelectedId(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (subjectId == null) {
    return <StatusAlert variant="warning">需要用户主体</StatusAlert>;
  }

  const showDetail = !compact || selectedId != null || creating || editing;

  const formPanel =
    creating || editing ? (
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-lg font-medium">{creating ? "新建习惯" : "编辑习惯"}</h2>
        <Input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="标题"
        />
        <Textarea
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          placeholder="说明"
          rows={2}
        />
        <label className="flex flex-col gap-1 text-sm">
          极性
          <select
            className="rounded-md border border-border bg-background px-2 py-2"
            value={draft.polarity}
            onChange={(e) => {
              const polarity = e.target.value === "break" ? "break" : "build";
              setDraft((d) => ({
                ...d,
                polarity,
                target: d.record_mode === "boolean" ? (polarity === "break" ? "0" : "1") : d.target,
              }));
            }}
          >
            <option value="build">养成</option>
            <option value="break">戒除</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          记录方式
          <select
            className="rounded-md border border-border bg-background px-2 py-2"
            value={draft.record_mode}
            onChange={(e) => {
              const v = e.target.value;
              const mode = v === "auto" || v === "manual" || v === "boolean" ? v : "boolean";
              setDraft((d) => ({
                ...d,
                record_mode: mode,
                target: mode === "boolean" ? (d.polarity === "break" ? "0" : "1") : d.target || "1",
              }));
            }}
          >
            <option value="boolean">{draft.polarity === "break" ? "严格零次" : "完成全部"}</option>
            <option value="auto">自动记录</option>
            <option value="manual">手动记录</option>
          </select>
        </label>
        {draft.record_mode === "boolean" && draft.polarity === "break" ? (
          <p className="text-muted-foreground text-xs">严格零次：记一次即超限；无记录算未超限。</p>
        ) : null}
        {draft.record_mode !== "boolean" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              {draft.polarity === "break" ? "日上限" : "日目标"}
              <Input
                value={draft.target}
                onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              单位
              <Input
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              />
            </label>
            {draft.record_mode === "auto" ? (
              <label className="flex flex-col gap-1 text-sm">
                每次量
                <Input
                  value={draft.auto_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, auto_amount: e.target.value }))}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          时段
          <select
            className="rounded-md border border-border bg-background px-2 py-2"
            value={draft.day_section}
            onChange={(e) => {
              const v = e.target.value;
              const section = SECTIONS.find((s) => s === v) ?? "other";
              setDraft((d) => ({ ...d, day_section: section }));
            }}
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {DAY_SECTION_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={draft.reminders}
          onChange={(e) => setDraft((d) => ({ ...d, reminders: e.target.value }))}
          placeholder="提醒 HH:mm，逗号分隔"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enable_journal}
            onChange={(e) => setDraft((d) => ({ ...d, enable_journal: e.target.checked }))}
          />
          启用打卡日志
        </label>
        <div className="flex gap-2">
          <Button onPress={() => void saveDraft()}>保存</Button>
          <Button
            variant="outline"
            onPress={() => {
              setCreating(false);
              setEditing(false);
            }}
          >
            取消
          </Button>
        </div>
      </div>
    ) : null;

  const detailPanel =
    !creating && !editing && selected ? (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-medium">
              {selected.icon ? `${selected.icon} ` : ""}
              {selected.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {POLARITY_LABEL[selected.polarity]} · {RECORD_MODE_LABEL[selected.record_mode]} ·{" "}
              {DAY_SECTION_LABEL[selected.day_section]}
            </p>
          </div>
          {compact ? (
            <Button variant="ghost" onPress={() => setSelectedId(null)}>
              关闭
            </Button>
          ) : null}
        </div>
        {selected.content ? (
          <p className="text-sm whitespace-pre-wrap">{selected.content}</p>
        ) : null}
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 text-sm font-medium">今日 · {progressLabel(selected)}</div>
          {selected.record_mode === "manual" ? (
            <Input
              className="mb-2"
              value={manualDelta}
              onChange={(e) => setManualDelta(e.target.value)}
              placeholder={amountDeltaPlaceholder(selected.polarity)}
            />
          ) : null}
          {selected.enable_journal ? (
            <Textarea
              className="mb-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="日志（可选）"
              rows={2}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onPress={() => void onCheckIn(selected)}>
              <Check className="size-4" /> {checkInActionLabel(selected.polarity)}
            </Button>
            {(selected.today_amount ?? 0) > 0 ? (
              <Button variant="outline" onPress={() => void onUndo(selected)}>
                撤销今日
              </Button>
            ) : null}
          </div>
        </div>
        {stats ? (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-medium">统计</div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-lg font-semibold">{stats.total_met_days}</div>
                <div className="text-muted-foreground">总达标</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.current_streak}</div>
                <div className="text-muted-foreground">连续</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.best_streak}</div>
                <div className="text-muted-foreground">最长</div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {stats.month_cells.map((c) => (
                <button
                  key={c.day}
                  type="button"
                  title={`${c.day} ${c.amount}`}
                  className={`aspect-square rounded text-[10px] ${
                    c.met
                      ? "bg-primary text-primary-foreground"
                      : c.amount > 0
                        ? "bg-primary/40"
                        : "bg-muted"
                  }`}
                  onClick={() => {
                    if (subjectId == null) return;
                    void checkInHabitRemote(subjectId, { habit_id: selected.id, day: c.day }).then(
                      (r) => {
                        setItems((prev) => prev.map((h) => (h.id === r.habit.id ? r.habit : h)));
                        void fetchHabitStats(subjectId, selected.id).then(setStats);
                      },
                    );
                  }}
                >
                  {Number(c.day.slice(-2))}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">点击日期可补记</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onPress={() => {
              window.location.assign(`/web/pomodoro?habitId=${selected.id}&autostart=1`);
            }}
          >
            开始专注
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setDraft(draftFromHabit(selected));
              setEditing(true);
            }}
          >
            编辑
          </Button>
          {view === "archived" ? (
            <Button
              variant="outline"
              onPress={() =>
                void unarchiveHabitRemote(subjectId, selected.id).then(() => {
                  setView("active");
                  void reload();
                })
              }
            >
              恢复
            </Button>
          ) : (
            <Button
              variant="outline"
              onPress={() =>
                void archiveHabitRemote(subjectId, selected.id).then(() => {
                  setSelectedId(null);
                  void reload();
                })
              }
            >
              <Archive className="size-4" /> 归档
            </Button>
          )}
          <Button
            variant="destructive"
            onPress={() =>
              void deleteHabitRemote(subjectId, selected.id).then(() => {
                setSelectedId(null);
                void reload();
              })
            }
          >
            <Trash2 className="size-4" /> 删除
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h1 className="mr-auto text-lg font-semibold">习惯</h1>
        <Button
          size="sm"
          variant={view === "active" ? "default" : "ghost"}
          onPress={() => setView("active")}
        >
          <Repeat className="size-4" /> 今日
        </Button>
        <Button
          size="sm"
          variant={view === "archived" ? "default" : "ghost"}
          onPress={() => setView("archived")}
        >
          <Archive className="size-4" /> 已归档
        </Button>
        <Button
          size="sm"
          variant={view === "presets" ? "default" : "ghost"}
          onPress={() => setView("presets")}
        >
          <Library className="size-4" /> 习惯库
        </Button>
        <Button
          size="sm"
          variant={view === "stats" ? "default" : "ghost"}
          onPress={() => setView("stats")}
        >
          <BarChart3 className="size-4" /> 统计
        </Button>
        {view === "active" ? (
          <Button
            size="sm"
            onPress={() => {
              setDraft(emptyDraft());
              setCreating(true);
              setEditing(false);
              setSelectedId(null);
            }}
          >
            <Plus className="size-4" /> 新建
          </Button>
        ) : null}
      </header>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      <div className={`flex min-h-0 flex-1 ${compact ? "flex-col" : "flex-row"}`}>
        {(!compact || !showDetail || view === "presets" || view === "stats") &&
        !(compact && (creating || editing)) ? (
          <PullToRefresh
            className={`min-h-0 flex-1 overflow-y-auto ${compact ? "" : "max-w-md border-r border-border"}`}
            onRefresh={() => reload()}
          >
            {loading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : view === "presets" ? (
              <div className="flex flex-col gap-1 p-2">
                {presets.map((p) => (
                  <ListRow
                    key={p.key}
                    as="div"
                    useActionSheet={useActionSheet}
                    className="gap-2 px-2 text-sm"
                    onClick={() => void createFromPreset(p)}
                  >
                    <span className="min-w-0 flex-1 py-1.5 text-left">
                      <span className="block font-medium">
                        {`${p.icon ?? ""} ${p.title}`.trim()}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {POLARITY_LABEL[p.polarity]} · {RECORD_MODE_LABEL[p.record_mode]}
                      </span>
                    </span>
                  </ListRow>
                ))}
              </div>
            ) : view === "stats" ? (
              <div className="flex flex-col gap-2 p-3">
                {items.length === 0 ? (
                  <EmptyState message="暂无习惯。先创建或从习惯库添加" />
                ) : (
                  items.map((h) => (
                    <ListRow
                      key={h.id}
                      as="div"
                      useActionSheet={useActionSheet}
                      className="gap-2 px-2 text-sm"
                      onClick={() => {
                        setView("active");
                        setSelectedId(h.id);
                      }}
                    >
                      <span className="min-w-0 flex-1 py-1.5 text-left">
                        <span className="block font-medium">{h.title}</span>
                        <span className={progressLabelClass(h)}>{progressLabel(h)}</span>
                      </span>
                    </ListRow>
                  ))
                )}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                message={
                  view === "archived" ? "无已归档习惯" : "还没有习惯。从习惯库添加，或点击新建"
                }
              />
            ) : (
              <div className="flex flex-col gap-4 p-2">
                {SECTIONS.map((section) => {
                  const list = grouped.get(section) ?? [];
                  if (list.length === 0) return null;
                  return (
                    <section key={section}>
                      <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                        {DAY_SECTION_LABEL[section]}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {list.map((h) => {
                          const btn = listCheckInButtonProps(h);
                          return (
                            <ListRow
                              key={h.id}
                              as="div"
                              selected={h.id === selectedId}
                              selectedClassName="bg-accent"
                              useActionSheet={useActionSheet}
                              className="gap-2 px-2 text-sm"
                              onClick={() => setSelectedId(h.id)}
                            >
                              <span className="min-w-0 flex-1 py-1.5 text-left">
                                <span className="block font-medium">
                                  {`${h.icon ?? ""} ${h.title}`.trim()}
                                </span>
                                <span className={progressLabelClass(h)}>{progressLabel(h)}</span>
                              </span>
                              {view === "active" ? (
                                <Button
                                  size="icon-sm"
                                  variant={btn.variant}
                                  title={btn.label}
                                  aria-label={btn.label}
                                  onPress={() => void onCheckIn(h)}
                                >
                                  {btn.icon === "check" ? (
                                    <Check className="size-4" />
                                  ) : btn.icon === "circle" ? (
                                    <Circle className="size-4" />
                                  ) : btn.icon === "plus" ? (
                                    <Plus className="size-4" />
                                  ) : (
                                    <TriangleAlert className="size-4" />
                                  )}
                                </Button>
                              ) : null}
                            </ListRow>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </PullToRefresh>
        ) : null}
        {showDetail && view !== "presets" && view !== "stats" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {formPanel}
            {detailPanel}
            {!formPanel && !detailPanel ? (
              <EmptyState message="选择一个习惯，查看详情与月度打卡" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
