import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { useSubjectScope, SubjectScopeToggle } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";
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

type CompletionMode =
  | "qualitative"
  | "metric_manual"
  | "tasks_completed"
  | "projects_completed"
  | "pomodoro";

const COMPLETION_MODES: readonly CompletionMode[] = [
  "qualitative",
  "metric_manual",
  "tasks_completed",
  "projects_completed",
  "pomodoro",
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
  return "qualitative";
}

function buildCompletion(
  mode: CompletionMode,
  unit: string,
  target: number,
  current: number,
  idsText: string,
  pomodoroCountBy: "sessions" | "minutes",
): ObjectiveCompletionPayload {
  if (mode === "qualitative") return { kind: "qualitative" };
  if (mode === "metric_manual") {
    return { kind: "metric_manual", unit: unit || "单位", target, current };
  }
  const ids = idsText
    .split(/[\s,，]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (mode === "tasks_completed") {
    return {
      kind: "metric_auto",
      unit: unit || "个",
      target: target > 0 ? target : ids.length,
      source: { type: "tasks_completed", task_ids: ids },
    };
  }
  if (mode === "projects_completed") {
    return {
      kind: "metric_auto",
      unit: unit || "个",
      target: target > 0 ? target : ids.length,
      source: { type: "projects_completed", project_ids: ids },
    };
  }
  return {
    kind: "metric_auto",
    unit: unit || (pomodoroCountBy === "minutes" ? "分钟" : "次"),
    target,
    source: {
      type: "pomodoro",
      filter: { count_by: pomodoroCountBy, ...(ids.length > 0 ? { task_ids: ids } : {}) },
    },
  };
}

export function ObjectiveApp() {
  const { kind: subjectKind } = useSubjectScope();
  const [items, setItems] = useState<ObjectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ObjectiveStatusPayload>("not_started");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [mode, setMode] = useState<CompletionMode>("qualitative");
  const [unit, setUnit] = useState("km");
  const [target, setTarget] = useState("100");
  const [current, setCurrent] = useState("0");
  const [idsText, setIdsText] = useState("");
  const [pomodoroCountBy, setPomodoroCountBy] = useState<"sessions" | "minutes">("sessions");
  const [parentId, setParentId] = useState<number | "">("");
  const [linkKind, setLinkKind] = useState<ObjectiveLinkPayload["kind"]>("project");
  const [linkId, setLinkId] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!selected) {
      setTitle("");
      setContent("");
      setStatus("not_started");
      setStartAt("");
      setEndAt("");
      setMode("qualitative");
      setUnit("km");
      setTarget("100");
      setCurrent("0");
      setIdsText("");
      setParentId("");
      return;
    }
    setTitle(selected.title);
    setContent(selected.content);
    setStatus(selected.status);
    setStartAt(selected.start_at?.slice(0, 16) ?? "");
    setEndAt(selected.end_at?.slice(0, 16) ?? "");
    setParentId(selected.parent_id ?? "");
    const m = completionModeOf(selected.completion);
    setMode(m);
    if (selected.completion.kind === "metric_manual") {
      setUnit(selected.completion.unit);
      setTarget(String(selected.completion.target));
      setCurrent(String(selected.completion.current));
      setIdsText("");
    } else if (selected.completion.kind === "metric_auto") {
      setUnit(selected.completion.unit);
      setTarget(String(selected.completion.target));
      setCurrent("0");
      const src = selected.completion.source;
      if (src.type === "tasks_completed") setIdsText(src.task_ids.join(", "));
      else if (src.type === "projects_completed") setIdsText(src.project_ids.join(", "));
      else if (src.type === "pomodoro") {
        setPomodoroCountBy(src.filter.count_by);
        setIdsText((src.filter.task_ids ?? []).join(", "));
      } else setIdsText("");
    } else {
      setUnit("km");
      setTarget("100");
      setCurrent("0");
      setIdsText("");
    }
  }, [selected]);

  const { roots, childrenOf } = useMemo(() => buildTree(items), [items]);

  const renderNode = (row: ObjectiveRow, depth: number) => {
    const progress = formatProgress(row);
    const kids = childrenOf.get(row.id) ?? [];
    return (
      <div key={row.id} className="space-y-1">
        <button
          type="button"
          className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
            selectedId === row.id ? "bg-accent" : "hover:bg-muted/60"
          }`}
          style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
          onClick={() => setSelectedId(row.id)}
        >
          <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{row.title}</span>
            <span className="text-xs text-muted-foreground">
              {OBJECTIVE_STATUS_LABEL[row.status]}
              {progress ? ` · ${progress}` : ""}
            </span>
          </span>
        </button>
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
        parent_id: typeof parentId === "number" ? parentId : null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
        completion: buildCompletion(
          mode,
          unit,
          Number(target) || 0,
          Number(current) || 0,
          idsText,
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
        parent_id: typeof parentId === "number" ? parentId : null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
        completion: buildCompletion(
          mode,
          unit,
          Number(target) || 0,
          Number(current) || 0,
          idsText,
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

  async function handleAddLink() {
    if (!selected) return;
    const id = Number(linkId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("请输入有效的链接实体 id");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await linkObjectiveRemote(subjectKind, selected.id, { kind: linkKind, id });
      setLinkId("");
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
            setTitle("");
            setContent("");
            setStatus("not_started");
            setMode("qualitative");
            setParentId("");
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
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">父目标 id（可空）</span>
                  <Input
                    value={parentId === "" ? "" : String(parentId)}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setParentId(v === "" ? "" : Number(v));
                    }}
                    placeholder="空=根目标"
                  />
                </label>
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
                    if (next) setMode(next);
                  }}
                >
                  <option value="qualitative">定性（非量化）</option>
                  <option value="metric_manual">手工量化（如跑量）</option>
                  <option value="tasks_completed">自动：指定任务完成数</option>
                  <option value="projects_completed">自动：指定项目完成数</option>
                  <option value="pomodoro">自动：番茄钟统计</option>
                </select>
                <p className="text-xs text-muted-foreground">习惯来源尚未落地，创建时不可选。</p>
                {mode !== "qualitative" ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">单位</span>
                      <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">目标值</span>
                      <Input value={target} onChange={(e) => setTarget(e.target.value)} />
                    </label>
                    {mode === "metric_manual" ? (
                      <label className="space-y-1 text-sm">
                        <span className="text-muted-foreground">当前值</span>
                        <Input value={current} onChange={(e) => setCurrent(e.target.value)} />
                      </label>
                    ) : null}
                    {mode === "pomodoro" ? (
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
                    ) : null}
                  </div>
                ) : null}
                {mode === "tasks_completed" ||
                mode === "projects_completed" ||
                mode === "pomodoro" ? (
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {mode === "pomodoro"
                        ? "可选：限定任务 id（逗号分隔）"
                        : "实体 id 列表（逗号分隔）"}
                    </span>
                    <Input value={idsText} onChange={(e) => setIdsText(e.target.value)} />
                  </label>
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
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">类型</span>
                      <select
                        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                        value={linkKind}
                        onChange={(e) => {
                          const parsed = objectiveLinkKindSchema.safeParse(e.target.value);
                          if (parsed.success) setLinkKind(parsed.data);
                        }}
                      >
                        {objectiveLinkKindSchema.options.map((k) => (
                          <option key={k} value={k}>
                            {OBJECTIVE_LINK_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">实体 id</span>
                      <Input value={linkId} onChange={(e) => setLinkId(e.target.value)} />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      isDisabled={saving}
                      onClick={() => void handleAddLink()}
                    >
                      添加链接
                    </Button>
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
    </div>
  );
}
