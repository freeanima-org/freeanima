import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import {
  useSubjectScope,
  SubjectScopeToggle,
  useActionSheetCapability,
  useContextMenuCapability,
} from "@freeanima/client/portal-sdk/react.tsx";
import { EntityPicker } from "@freeanima/features/entity/ui/spa/components/EntityPicker.tsx";
import { Button, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import {
  ActionSheet,
  EmptyState,
  ListRow,
  StatusAlert,
  PullToRefresh,
  type ActionSheetItem,
} from "@freeanima/ui-kit/composite";
import type {
  ObjectiveCompletionPayload,
  ObjectiveLinkPayload,
  ObjectiveStatusPayload,
} from "@freeanima/shared/rpc-contract/frames/objective.ts";
import {
  objectiveLinkKindSchema,
  objectiveStatusSchema,
} from "@freeanima/shared/rpc-contract/frames/objective.ts";

import {
  OBJECTIVE_LINK_KIND_LABEL,
  OBJECTIVE_STATUS_LABEL,
  createObjectiveRemote,
  deleteObjectiveRemote,
  fetchObjectives,
  formatProgress,
  linkHref,
  linkObjectiveRemote,
  patchObjectiveRemote,
  unlinkObjectiveRemote,
  type ObjectiveRow,
} from "./lib/api.ts";
import { buildObjectiveMenuItems } from "./lib/objective-menus.ts";

const LINK_PRIMARY_COMPONENTS = objectiveLinkKindSchema.options;

type CompletionMode =
  | "qualitative"
  | "metric_manual"
  | "tasks_completed"
  | "projects_completed"
  | "pomodoro"
  | "children_completed";

const COMPLETION_MODES: readonly CompletionMode[] = [
  "qualitative",
  "metric_manual",
  "tasks_completed",
  "projects_completed",
  "pomodoro",
  "children_completed",
];

const POMODORO_COUNT_BY = ["sessions", "minutes"] as const;

function parseCompletionMode(value: string): CompletionMode | null {
  return (COMPLETION_MODES as readonly string[]).includes(value)
    ? (COMPLETION_MODES.find((m) => m === value) ?? null)
    : null;
}

function parsePomodoroCountBy(value: string): "sessions" | "minutes" | null {
  if (value === "sessions" || value === "minutes") return value;
  return null;
}

const STATUS_OPTIONS: ObjectiveStatusPayload[] = [
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
  "on_hold",
];

function buildTree(items: ObjectiveRow[]): {
  roots: ObjectiveRow[];
  childrenOf: Map<number, ObjectiveRow[]>;
} {
  const childrenOf = new Map<number, ObjectiveRow[]>();
  const roots: ObjectiveRow[] = [];
  for (const item of items) {
    if (item.parent_id == null) {
      roots.push(item);
      continue;
    }
    const list = childrenOf.get(item.parent_id) ?? [];
    list.push(item);
    childrenOf.set(item.parent_id, list);
  }
  return { roots, childrenOf };
}

function completionModeOf(c: ObjectiveCompletionPayload): CompletionMode {
  if (c.kind === "qualitative") return "qualitative";
  if (c.kind === "metric_manual") return "metric_manual";
  if (c.source.type === "tasks_completed") return "tasks_completed";
  if (c.source.type === "projects_completed") return "projects_completed";
  if (c.source.type === "pomodoro") return "pomodoro";
  if (c.source.type === "children_completed") return "children_completed";
  return "qualitative";
}

function buildCompletion(
  mode: CompletionMode,
  unit: string,
  target: number,
  current: number,
  entityIds: number[],
  pomodoroCountBy: "sessions" | "minutes",
): ObjectiveCompletionPayload {
  if (mode === "qualitative") return { kind: "qualitative" };
  if (mode === "metric_manual") {
    return { kind: "metric_manual", unit: unit || "单位", target, current };
  }
  if (mode === "tasks_completed") {
    return {
      kind: "metric_auto",
      unit: "个",
      target: entityIds.length,
      source: { type: "tasks_completed", task_ids: entityIds },
    };
  }
  if (mode === "projects_completed") {
    return {
      kind: "metric_auto",
      unit: "个",
      target: entityIds.length,
      source: { type: "projects_completed", project_ids: entityIds },
    };
  }
  if (mode === "children_completed") {
    return {
      kind: "metric_auto",
      unit: "个",
      target: 0,
      source: { type: "children_completed" },
    };
  }
  return {
    kind: "metric_auto",
    unit: pomodoroCountBy === "minutes" ? "分钟" : "次",
    target,
    source: {
      type: "pomodoro",
      filter: {
        count_by: pomodoroCountBy,
        ...(entityIds.length > 0 ? { task_ids: entityIds } : {}),
      },
    },
  };
}

function resetDraftForm(setters: {
  setTitle: (v: string) => void;
  setContent: (v: string) => void;
  setStatus: (v: ObjectiveStatusPayload) => void;
  setStartAt: (v: string) => void;
  setEndAt: (v: string) => void;
  setMode: (v: CompletionMode) => void;
  setUnit: (v: string) => void;
  setTarget: (v: string) => void;
  setCurrent: (v: string) => void;
  setEntityIds: (v: number[]) => void;
  setPomodoroCountBy: (v: "sessions" | "minutes") => void;
  setParentId: (v: number | null) => void;
}) {
  setters.setTitle("");
  setters.setContent("");
  setters.setStatus("not_started");
  setters.setStartAt("");
  setters.setEndAt("");
  setters.setMode("qualitative");
  setters.setUnit("km");
  setters.setTarget("100");
  setters.setCurrent("0");
  setters.setEntityIds([]);
  setters.setPomodoroCountBy("sessions");
  setters.setParentId(null);
}

export function ObjectiveApp() {
  const { kind: subjectKind } = useSubjectScope();
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useActionSheetCapability();
  const [items, setItems] = useState<ObjectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetItems, setSheetItems] = useState<ActionSheetItem[] | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ObjectiveStatusPayload>("not_started");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [mode, setMode] = useState<CompletionMode>("qualitative");
  const [unit, setUnit] = useState("km");
  const [target, setTarget] = useState("100");
  const [current, setCurrent] = useState("0");
  const [entityIds, setEntityIds] = useState<number[]>([]);
  const [pomodoroCountBy, setPomodoroCountBy] = useState<"sessions" | "minutes">("sessions");
  const [parentId, setParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const draftSetters = useMemo(
    () => ({
      setTitle,
      setContent,
      setStatus,
      setStartAt,
      setEndAt,
      setMode,
      setUnit,
      setTarget,
      setCurrent,
      setEntityIds,
      setPomodoroCountBy,
      setParentId,
    }),
    [],
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await fetchObjectives(subjectKind, { include_inactive: includeInactive });
      setItems(rows);
      setSelectedId((prev) => {
        if (prev != null && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectKind, includeInactive]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setContent(selected.content);
    setStatus(selected.status);
    setStartAt(selected.start_at?.slice(0, 16) ?? "");
    setEndAt(selected.end_at?.slice(0, 16) ?? "");
    setParentId(selected.parent_id);
    const m = completionModeOf(selected.completion);
    setMode(m);
    if (selected.completion.kind === "metric_manual") {
      setUnit(selected.completion.unit);
      setTarget(String(selected.completion.target));
      setCurrent(String(selected.completion.current));
      setEntityIds([]);
    } else if (selected.completion.kind === "metric_auto") {
      setUnit(selected.completion.unit);
      setTarget(String(selected.completion.target));
      setCurrent("0");
      const src = selected.completion.source;
      if (src.type === "tasks_completed") setEntityIds(src.task_ids);
      else if (src.type === "projects_completed") setEntityIds(src.project_ids);
      else if (src.type === "pomodoro") {
        setPomodoroCountBy(src.filter.count_by);
        setEntityIds(src.filter.task_ids ?? []);
      } else setEntityIds([]);
    } else {
      setUnit("km");
      setTarget("100");
      setCurrent("0");
      setEntityIds([]);
    }
  }, [selected]);

  const { roots, childrenOf } = useMemo(() => buildTree(items), [items]);

  async function handleStatusChange(row: ObjectiveRow, next: ObjectiveStatusPayload) {
    setSaving(true);
    setError("");
    try {
      await patchObjectiveRemote(subjectKind, row.id, { status: next });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleAddChild(parent: ObjectiveRow) {
    setSelectedId(null);
    resetDraftForm(draftSetters);
    setParentId(parent.id);
  }

  function menuItemsFor(row: ObjectiveRow): ActionSheetItem[] {
    return buildObjectiveMenuItems(row, {
      onAddChild: handleAddChild,
      onStatusChange: (r, s) => void handleStatusChange(r, s),
    });
  }

  const renderNode = (row: ObjectiveRow, depth: number) => {
    const progress = formatProgress(row);
    const kids = childrenOf.get(row.id) ?? [];
    const menuItems = menuItemsFor(row);
    return (
      <div key={row.id} className="space-y-1">
        <ListRow
          as="div"
          selected={selectedId === row.id}
          selectedClassName="bg-accent"
          useActionSheet={useActionSheet}
          contextMenuEnabled={contextMenuEnabled}
          contextMenuItems={menuItems}
          longPressEnabled={useActionSheet}
          onLongPress={() => setSheetItems(menuItems)}
          onOpenMenu={() => setSheetItems(menuItems)}
          className="gap-2 pr-1 text-sm"
          rowStyle={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
          onClick={() => setSelectedId(row.id)}
          leading={<Target className="text-muted-foreground size-3.5 shrink-0" />}
        >
          <span className="min-w-0 flex-1 py-1.5 text-left">
            <span className="block truncate font-medium">{row.title}</span>
            <span className="text-muted-foreground text-xs">
              {OBJECTIVE_STATUS_LABEL[row.status]}
              {progress ? ` · ${progress}` : ""}
            </span>
          </span>
        </ListRow>
        {kids.map((kid) => renderNode(kid, depth + 1))}
      </div>
    );
  };

  async function handleCreate() {
    setSaving(true);
    setError("");
    try {
      const item = await createObjectiveRemote(subjectKind, {
        title: title.trim() || "未命名目标",
        content,
        status,
        parent_id: parentId,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
        completion: buildCompletion(
          mode,
          unit,
          Number(target) || 0,
          Number(current) || 0,
          entityIds,
          pomodoroCountBy,
        ),
      });
      await load();
      setSelectedId(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await patchObjectiveRemote(subjectKind, selected.id, {
        title: title.trim() || selected.title,
        content,
        status,
        parent_id: parentId,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
        completion: buildCompletion(
          mode,
          unit,
          Number(target) || 0,
          Number(current) || 0,
          entityIds,
          pomodoroCountBy,
        ),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await deleteObjectiveRemote(subjectKind, selected.id);
      setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLinkFromEntity(id: number | null, primaryComponent: string | null) {
    if (!selected || id == null) return;
    const parsed = objectiveLinkKindSchema.safeParse(primaryComponent);
    if (!parsed.success) {
      setError("所选实体类型不能作为执行链接");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await linkObjectiveRemote(subjectKind, selected.id, { kind: parsed.data, id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveLink(link: ObjectiveLinkPayload) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await unlinkObjectiveRemote(subjectKind, selected.id, link);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">目标</h1>
          <p className="text-sm text-muted-foreground">
            管理多层级个人目标；执行可链接到项目、任务、清单与日程。
          </p>
        </div>
        <SubjectScopeToggle />
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          显示已完成/取消/暂停
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSelectedId(null);
            resetDraftForm(draftSetters);
          }}
        >
          <Plus className="size-4" />
          新建
        </Button>
      </div>

      <PullToRefresh onRefresh={load} className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(14rem,20rem)_1fr]">
            <div className="min-h-0 overflow-auto rounded-lg border p-2">
              {roots.length === 0 ? (
                <EmptyState message="暂无目标。创建一个目标开始规划。" />
              ) : (
                roots.map((r) => renderNode(r, 0))
              )}
            </div>

            <div className="min-h-0 space-y-3 overflow-auto rounded-lg border p-4">
              {!selected && parentId != null ? (
                <p className="text-muted-foreground text-sm">
                  正在创建子目标（父目标 #{parentId}）
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">标题</span>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：8 月跑量"
                  />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">说明 / 成功标准</span>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    placeholder="可选"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">状态</span>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={status}
                    onChange={(e) => {
                      const parsed = objectiveStatusSchema.safeParse(e.target.value);
                      if (parsed.success) setStatus(parsed.data);
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {OBJECTIVE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-1 text-sm">
                  <span className="text-muted-foreground">父目标（可空）</span>
                  <EntityPicker
                    mode="single"
                    value={parentId}
                    onChange={(id) => setParentId(id)}
                    primaryComponents={["objective"]}
                    excludeIds={selectedId != null ? [selectedId] : []}
                    placeholder="选择父目标…"
                    disabled={saving}
                  />
                </div>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">开始</span>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">结束</span>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-medium">完成标准</div>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={mode}
                  onChange={(e) => {
                    const next = parseCompletionMode(e.target.value);
                    if (next) {
                      setMode(next);
                      setEntityIds([]);
                    }
                  }}
                >
                  <option value="qualitative">定性（非量化）</option>
                  <option value="metric_manual">手工量化（如跑量）</option>
                  <option value="tasks_completed">自动：指定任务完成数</option>
                  <option value="projects_completed">自动：指定项目完成数</option>
                  <option value="children_completed">自动：子目标完成率</option>
                  <option value="pomodoro">自动：番茄钟统计</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  自动类进度实时统计；任务/项目的目标数=列表长度；子目标完成率按直系子目标现算（已取消不计）。习惯来源尚未落地。
                </p>
                {mode === "metric_manual" ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">单位</span>
                      <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">目标值</span>
                      <Input value={target} onChange={(e) => setTarget(e.target.value)} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">当前值</span>
                      <Input value={current} onChange={(e) => setCurrent(e.target.value)} />
                    </label>
                  </div>
                ) : null}
                {mode === "pomodoro" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">统计方式</span>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                        value={pomodoroCountBy}
                        onChange={(e) => {
                          const next = parsePomodoroCountBy(e.target.value);
                          if (next) setPomodoroCountBy(next);
                        }}
                      >
                        {POMODORO_COUNT_BY.map((v) => (
                          <option key={v} value={v}>
                            {v === "sessions" ? "次数" : "分钟"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">
                        目标{pomodoroCountBy === "minutes" ? "分钟" : "次数"}
                      </span>
                      <Input value={target} onChange={(e) => setTarget(e.target.value)} />
                    </label>
                  </div>
                ) : null}
                {mode === "tasks_completed" || mode === "projects_completed" ? (
                  <p className="text-xs text-muted-foreground">
                    目标：完成列表中全部 {entityIds.length} 个
                    {mode === "tasks_completed" ? "任务" : "项目"}（进度实时统计）
                  </p>
                ) : null}
                {mode === "children_completed" ? (
                  <p className="text-xs text-muted-foreground">
                    进度 = 已完成的直系子目标数 / 非取消的直系子目标总数（读侧现算，无需选手目标）。
                  </p>
                ) : null}
                {mode === "tasks_completed" ||
                mode === "projects_completed" ||
                mode === "pomodoro" ? (
                  <div className="space-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {mode === "pomodoro"
                        ? "可选：限定任务"
                        : mode === "tasks_completed"
                          ? "选择任务"
                          : "选择项目"}
                    </span>
                    <EntityPicker
                      mode="multi"
                      value={entityIds}
                      onChange={(ids) => setEntityIds(ids)}
                      primaryComponents={
                        mode === "projects_completed" ? ["project"] : ["task_item"]
                      }
                      placeholder={mode === "projects_completed" ? "添加项目…" : "添加任务…"}
                      disabled={saving}
                    />
                  </div>
                ) : null}
                {selected?.resolved_progress ? (
                  <p className="text-sm">
                    进度：{formatProgress(selected)}（来源 {selected.resolved_progress.source}）
                  </p>
                ) : null}
              </div>

              {selected ? (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-medium">执行链接</div>
                  <ul className="space-y-1 text-sm">
                    {selected.links.length === 0 ? (
                      <li className="text-muted-foreground">暂无链接</li>
                    ) : (
                      selected.links.map((link) => (
                        <li key={`${link.kind}:${link.id}`} className="flex items-center gap-2">
                          <a className="text-primary underline" href={linkHref(link)}>
                            {OBJECTIVE_LINK_KIND_LABEL[link.kind]} #{link.id}
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleRemoveLink(link)}
                          >
                            移除
                          </Button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="space-y-1 text-sm">
                    <span className="text-muted-foreground">添加链接</span>
                    <EntityPicker
                      mode="single"
                      value={null}
                      onChange={(id, row) => {
                        void handleAddLinkFromEntity(id, row?.primary_component ?? null);
                      }}
                      primaryComponents={[...LINK_PRIMARY_COMPONENTS]}
                      placeholder="搜索并添加执行实体…"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {selected ? (
                  <>
                    <Button type="button" isDisabled={saving} onClick={() => void handleSave()}>
                      保存
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      isDisabled={saving}
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="size-4" />
                      删除（含子目标）
                    </Button>
                  </>
                ) : (
                  <Button type="button" isDisabled={saving} onClick={() => void handleCreate()}>
                    <Plus className="size-4" />
                    创建目标
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </PullToRefresh>
      {sheetItems ? <ActionSheet items={sheetItems} onClose={() => setSheetItems(null)} /> : null}
    </div>
  );
}
