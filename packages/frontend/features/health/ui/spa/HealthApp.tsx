import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Stethoscope,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useUserSubjectId } from "@freeanima/client/portal-sdk/react.tsx";
import type { LucideIcon } from "lucide-react";
import {
  HEALTH_METRIC_CATALOG,
  HEALTH_RECORD_KIND_LABELS,
  HEALTH_RECORD_KINDS,
  healthMetricsForKind,
} from "@freeanima/shared/health/metric-catalog.ts";
import {
  healthRecordKindSchema,
  healthVisitTypeSchema,
} from "@freeanima/shared/rpc-contract/frames/health.ts";
import { Button, Input, Select, SelectItem, Spinner } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";
import { EntityPicker } from "@freeanima/features/entity/ui/spa/components/EntityPicker.tsx";

import {
  attachHealthFilesRemote,
  createHealthRecordRemote,
  deleteHealthRecordRemote,
  fetchHealthMetricSeries,
  fetchHealthRecords,
  patchHealthRecordRemote,
  type HealthRow,
} from "./lib/api.ts";

type HealthRecordKind = HealthRow["record_kind"];

type KindFilter = "all" | HealthRecordKind;

type ReadingDraft = { metric_key: string; value: string; unit: string };
type ExamItemDraft = {
  metric_key: string;
  name: string;
  value: string;
  unit: string;
  ref_low: string;
  ref_high: string;
};

type Draft = {
  record_kind: HealthRecordKind;
  recorded_at: string;
  title: string;
  content: string;
  readings: ReadingDraft[];
  exam_items: ExamItemDraft[];
  medication_source: "" | "prescription" | "self_purchase";
  dosage: string;
  frequency: string;
  start_at: string;
  end_at: string;
  related_task_id: number | null;
  visit_type: "" | "blood" | "chest_xray" | "ct" | "diagnosis" | "other";
  facility: string;
  doctor_name: string;
  follow_up_at: string;
};

function kindIcon(kind: HealthRecordKind): LucideIcon {
  switch (kind) {
    case "vital_sign":
      return HeartPulse;
    case "medical_visit":
      return Stethoscope;
    case "medication":
      return Pill;
    case "physical_exam":
      return FileText;
    default:
      return Activity;
  }
}

function kindColor(kind: HealthRecordKind): string {
  switch (kind) {
    case "vital_sign":
      return "bg-rose-500";
    case "medical_visit":
      return "bg-sky-500";
    case "medication":
      return "bg-violet-500";
    case "physical_exam":
      return "bg-amber-500";
    default:
      return "bg-muted";
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromLocalDatetimeValue(value: string): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function emptyReading(): ReadingDraft {
  return { metric_key: "heart_rate", value: "", unit: "" };
}

function emptyExamItem(): ExamItemDraft {
  return { metric_key: "glucose", name: "", value: "", unit: "", ref_low: "", ref_high: "" };
}

function emptyDraft(kind: HealthRecordKind = "vital_sign"): Draft {
  return {
    record_kind: kind,
    recorded_at: toLocalDatetimeValue(new Date().toISOString()),
    title: "",
    content: "",
    readings: [emptyReading()],
    exam_items: [emptyExamItem()],
    medication_source: "",
    dosage: "",
    frequency: "",
    start_at: "",
    end_at: "",
    related_task_id: null,
    visit_type: "",
    facility: "",
    doctor_name: "",
    follow_up_at: "",
  };
}

function draftFromRow(row: HealthRow): Draft {
  return {
    record_kind: row.record_kind,
    recorded_at: toLocalDatetimeValue(row.recorded_at),
    title: row.title,
    content: row.content,
    readings:
      row.readings.length > 0
        ? row.readings.map((r) => ({
            metric_key: r.metric_key,
            value: String(r.value),
            unit: r.unit ?? "",
          }))
        : [emptyReading()],
    exam_items:
      row.exam_items.length > 0
        ? row.exam_items.map((i) => ({
            metric_key: i.metric_key,
            name: i.name,
            value: String(i.value),
            unit: i.unit ?? "",
            ref_low: i.ref_low != null ? String(i.ref_low) : "",
            ref_high: i.ref_high != null ? String(i.ref_high) : "",
          }))
        : [emptyExamItem()],
    medication_source: row.medication_source ?? "",
    dosage: row.dosage ?? "",
    frequency: row.frequency ?? "",
    start_at: row.start_at ? toLocalDatetimeValue(row.start_at) : "",
    end_at: row.end_at ? toLocalDatetimeValue(row.end_at) : "",
    related_task_id: row.related_task_id,
    visit_type: row.visit_type ?? "",
    facility: row.facility ?? "",
    doctor_name: row.doctor_name ?? "",
    follow_up_at: row.follow_up_at ? toLocalDatetimeValue(row.follow_up_at) : "",
  };
}

function formatRecordedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

function examFlagClass(flag: string | undefined): string {
  if (flag === "high" || flag === "low") return "text-destructive font-medium";
  if (flag === "normal") return "text-emerald-600";
  return "text-muted-foreground";
}

function buildPayload(draft: Draft) {
  const readings = draft.readings
    .map((r) => ({
      metric_key: r.metric_key,
      value: Number.parseFloat(r.value),
      ...(r.unit.trim() ? { unit: r.unit.trim() } : {}),
    }))
    .filter((r) => Number.isFinite(r.value));

  const exam_items = draft.exam_items
    .filter((i) => i.name.trim())
    .map((i) => {
      const num = Number.parseFloat(i.value);
      const value = Number.isFinite(num) ? num : i.value.trim();
      const ref_low = i.ref_low.trim() ? Number.parseFloat(i.ref_low) : null;
      const ref_high = i.ref_high.trim() ? Number.parseFloat(i.ref_high) : null;
      return {
        metric_key: i.metric_key,
        name: i.name.trim(),
        value,
        ...(i.unit.trim() ? { unit: i.unit.trim() } : {}),
        ...(ref_low != null && Number.isFinite(ref_low) ? { ref_low } : {}),
        ...(ref_high != null && Number.isFinite(ref_high) ? { ref_high } : {}),
      };
    });

  return {
    record_kind: draft.record_kind,
    recorded_at: fromLocalDatetimeValue(draft.recorded_at),
    title: draft.title.trim() || HEALTH_RECORD_KIND_LABELS[draft.record_kind],
    content: draft.content.trim(),
    ...(readings.length > 0 ? { readings } : {}),
    ...(exam_items.length > 0 ? { exam_items } : {}),
    ...(draft.medication_source ? { medication_source: draft.medication_source } : {}),
    ...(draft.dosage.trim() ? { dosage: draft.dosage.trim() } : {}),
    ...(draft.frequency.trim() ? { frequency: draft.frequency.trim() } : {}),
    ...(draft.start_at ? { start_at: fromLocalDatetimeValue(draft.start_at) } : {}),
    ...(draft.end_at ? { end_at: fromLocalDatetimeValue(draft.end_at) } : {}),
    related_task_id: draft.related_task_id,
    ...(draft.visit_type ? { visit_type: draft.visit_type } : {}),
    ...(draft.facility.trim() ? { facility: draft.facility.trim() } : {}),
    ...(draft.doctor_name.trim() ? { doctor_name: draft.doctor_name.trim() } : {}),
    ...(draft.follow_up_at ? { follow_up_at: fromLocalDatetimeValue(draft.follow_up_at) } : {}),
  };
}

export function HealthApp() {
  const subjectId = useUserSubjectId();
  const [items, setItems] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [seriesMetric, setSeriesMetric] = useState("heart_rate");
  const [seriesPoints, setSeriesPoints] = useState<
    Array<{ recorded_at: string; value: number; record_id: number }>
  >([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [showSeries, setShowSeries] = useState(false);

  const filteredItems = useMemo(() => {
    if (kindFilter === "all") return items;
    return items.filter((i) => i.record_kind === kindFilter);
  }, [items, kindFilter]);

  const selected = selectedId != null ? items.find((i) => i.id === selectedId) : null;

  const load = useCallback(async () => {
    if (subjectId == null) return;
    setError("");
    try {
      const rows = await fetchHealthRecords(subjectId, { limit: 500 });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (subjectId == null) {
      setLoading(true);
      return;
    }
    setLoading(true);
    void load();
  }, [load, subjectId]);

  useEffect(() => {
    if (selected) setDraft(draftFromRow(selected));
  }, [selected]);

  const loadSeries = useCallback(async () => {
    if (subjectId == null) return;
    setSeriesLoading(true);
    try {
      const points = await fetchHealthMetricSeries(subjectId, seriesMetric, { limit: 30 });
      setSeriesPoints(points);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeriesLoading(false);
    }
  }, [seriesMetric, subjectId]);

  useEffect(() => {
    if (!showSeries || subjectId == null) return;
    void loadSeries();
  }, [showSeries, loadSeries, subjectId]);

  const startCreate = (kind: HealthRecordKind = "vital_sign") => {
    setSelectedId(null);
    setDraft(emptyDraft(kind));
    setPendingFiles([]);
  };

  const save = async () => {
    if (subjectId == null) return;
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload(draft);
      let item: HealthRow;
      if (selectedId != null) {
        item = await patchHealthRecordRemote(subjectId, selectedId, payload);
      } else {
        item = await createHealthRecordRemote(subjectId, payload);
        setSelectedId(item.id);
      }
      if (pendingFiles.length > 0) {
        item = await attachHealthFilesRemote(subjectId, item.id, pendingFiles);
        setPendingFiles([]);
      }
      await load();
      setSelectedId(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (subjectId == null || selectedId == null) return;
    setSaving(true);
    setError("");
    try {
      await deleteHealthRecordRemote(subjectId, selectedId);
      setSelectedId(null);
      setDraft(emptyDraft());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (subjectId == null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">健康</h1>
          <p className="text-sm text-muted-foreground">体征、就诊、用药与体检记录（私有 world）</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setShowSeries((v) => !v)}>
            <TrendingUp className="size-4" />
            指标趋势
          </Button>
          <Button
            type="button"
            onClick={() => startCreate(kindFilter === "all" ? "vital_sign" : kindFilter)}
          >
            <Plus className="size-4" />
            新建记录
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={kindFilter === "all" ? "default" : "outline"}
          onClick={() => setKindFilter("all")}
        >
          全部
        </Button>
        {HEALTH_RECORD_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={kindFilter === kind ? "default" : "outline"}
            onClick={() => setKindFilter(kind)}
          >
            {HEALTH_RECORD_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {showSeries ? (
        <div className="border-border rounded-md border p-3">
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>指标</span>
              <Select
                selectedKey={seriesMetric}
                onSelectionChange={(key) => {
                  if (typeof key === "string") setSeriesMetric(key);
                }}
                className="min-w-[10rem]"
              >
                {HEALTH_METRIC_CATALOG.map((m) => (
                  <SelectItem key={m.key} id={m.key}>
                    {m.label} ({m.unit})
                  </SelectItem>
                ))}
              </Select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              isDisabled={seriesLoading}
              onClick={() => void loadSeries()}
            >
              刷新
            </Button>
          </div>
          {seriesLoading ? (
            <Spinner className="size-5" />
          ) : seriesPoints.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无该指标的历史数据</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {seriesPoints.map((p) => (
                <li key={`${p.record_id}-${p.recorded_at}`} className="flex justify-between gap-2">
                  <span>{formatRecordedAt(p.recorded_at)}</span>
                  <span className="font-medium tabular-nums">{p.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(14rem,22rem)_1fr]">
        <PullToRefresh
          onRefresh={async () => {
            await load();
          }}
          className="border-border flex min-h-0 flex-col overflow-hidden rounded-md border"
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Spinner className="size-6" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-8" />}
              message="暂无健康记录。点击「新建记录」开始记录。"
            />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {filteredItems.map((item) => {
                // oxlint-disable-next-line typescript/no-unsafe-assignment -- lucide 组件在 oxlint 类型图中未解析
                const Icon = kindIcon(item.record_kind);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`hover:bg-muted/60 flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                        selectedId === item.id ? "bg-muted" : ""
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span
                        className={`mt-1 size-1 shrink-0 rounded-full ${kindColor(item.record_kind)}`}
                        aria-hidden
                      />
                      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {HEALTH_RECORD_KIND_LABELS[item.record_kind]}
                          </span>
                        </span>
                        <span className="text-muted-foreground line-clamp-1 text-xs">
                          {formatRecordedAt(item.recorded_at)} · {item.summary || "—"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PullToRefresh>

        <div className="border-border flex min-h-0 flex-col gap-3 overflow-y-auto rounded-md border p-4">
          <h2 className="text-base font-medium">{selectedId != null ? "编辑记录" : "新建记录"}</h2>

          <label className="flex flex-col gap-1 text-sm">
            <span>类型</span>
            <Select
              selectedKey={draft.record_kind}
              onSelectionChange={(key) => {
                const parsed = healthRecordKindSchema.safeParse(key);
                if (parsed.success) {
                  setDraft((d) => ({ ...d, record_kind: parsed.data }));
                }
              }}
            >
              {HEALTH_RECORD_KINDS.map((kind) => (
                <SelectItem key={kind} id={kind}>
                  {HEALTH_RECORD_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>记录时间</span>
            <Input
              type="datetime-local"
              value={draft.recorded_at}
              onChange={(e) => setDraft((d) => ({ ...d, recorded_at: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>标题</span>
            <Input
              value={draft.title}
              placeholder={HEALTH_RECORD_KIND_LABELS[draft.record_kind]}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>备注</span>
            <Input
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            />
          </label>

          {draft.record_kind === "vital_sign" ? (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">体征读数</span>
              {draft.readings.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_6rem_5rem_auto] gap-2">
                  <Select
                    selectedKey={row.metric_key}
                    onSelectionChange={(key) => {
                      if (typeof key !== "string") return;
                      const def = healthMetricsForKind("vital_sign").find((m) => m.key === key);
                      setDraft((d) => ({
                        ...d,
                        readings: d.readings.map((r, i) =>
                          i === index ? { ...r, metric_key: key, unit: def?.unit ?? r.unit } : r,
                        ),
                      }));
                    }}
                  >
                    {healthMetricsForKind("vital_sign").map((m) => (
                      <SelectItem key={m.key} id={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="数值"
                    value={row.value}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        readings: d.readings.map((r, i) =>
                          i === index ? { ...r, value: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="单位"
                    value={row.unit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        readings: d.readings.map((r, i) =>
                          i === index ? { ...r, unit: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        readings: d.readings.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    删
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((d) => ({ ...d, readings: [...d.readings, emptyReading()] }))
                }
              >
                添加读数
              </Button>
            </div>
          ) : null}

          {draft.record_kind === "physical_exam" ? (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">检验项</span>
              {draft.exam_items.map((row, index) => (
                <div key={index} className="border-border space-y-2 rounded border p-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="名称"
                      value={row.name}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          exam_items: d.exam_items.map((it, i) =>
                            i === index ? { ...it, name: e.target.value } : it,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="数值"
                      value={row.value}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          exam_items: d.exam_items.map((it, i) =>
                            i === index ? { ...it, value: e.target.value } : it,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="单位"
                      value={row.unit}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          exam_items: d.exam_items.map((it, i) =>
                            i === index ? { ...it, unit: e.target.value } : it,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="参考下限"
                      value={row.ref_low}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          exam_items: d.exam_items.map((it, i) =>
                            i === index ? { ...it, ref_low: e.target.value } : it,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="参考上限"
                      value={row.ref_high}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          exam_items: d.exam_items.map((it, i) =>
                            i === index ? { ...it, ref_high: e.target.value } : it,
                          ),
                        }))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        exam_items: d.exam_items.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    删除此项
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((d) => ({ ...d, exam_items: [...d.exam_items, emptyExamItem()] }))
                }
              >
                添加检验项
              </Button>
            </div>
          ) : null}

          {draft.record_kind === "medication" ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>来源</span>
                <Select
                  selectedKey={draft.medication_source || "none"}
                  onSelectionChange={(key) => {
                    if (key === "none") {
                      setDraft((d) => ({ ...d, medication_source: "" }));
                    } else if (key === "prescription" || key === "self_purchase") {
                      setDraft((d) => ({ ...d, medication_source: key }));
                    }
                  }}
                >
                  <SelectItem id="none">未指定</SelectItem>
                  <SelectItem id="prescription">处方</SelectItem>
                  <SelectItem id="self_purchase">自购</SelectItem>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>剂量</span>
                <Input
                  value={draft.dosage}
                  onChange={(e) => setDraft((d) => ({ ...d, dosage: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>频率</span>
                <Input
                  value={draft.frequency}
                  onChange={(e) => setDraft((d) => ({ ...d, frequency: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>开始</span>
                  <Input
                    type="datetime-local"
                    value={draft.start_at}
                    onChange={(e) => setDraft((d) => ({ ...d, start_at: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>结束</span>
                  <Input
                    type="datetime-local"
                    value={draft.end_at}
                    onChange={(e) => setDraft((d) => ({ ...d, end_at: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span>用药提醒任务（可选）</span>
                <EntityPicker
                  mode="single"
                  value={draft.related_task_id}
                  primaryComponents={["task_item"]}
                  placeholder="关联任务"
                  onChange={(id) => setDraft((d) => ({ ...d, related_task_id: id }))}
                />
                <p className="text-muted-foreground text-xs">
                  提醒请通过任务模块配置 recurrence；此处仅关联引用。
                </p>
              </div>
            </>
          ) : null}

          {draft.record_kind === "medical_visit" ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>就诊类型</span>
                <Select
                  selectedKey={draft.visit_type || "other"}
                  onSelectionChange={(key) => {
                    const parsed = healthVisitTypeSchema.safeParse(key);
                    if (parsed.success) {
                      setDraft((d) => ({ ...d, visit_type: parsed.data }));
                    }
                  }}
                >
                  <SelectItem id="blood">血液</SelectItem>
                  <SelectItem id="chest_xray">胸片</SelectItem>
                  <SelectItem id="ct">CT</SelectItem>
                  <SelectItem id="diagnosis">诊断</SelectItem>
                  <SelectItem id="other">其他</SelectItem>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>机构</span>
                <Input
                  value={draft.facility}
                  onChange={(e) => setDraft((d) => ({ ...d, facility: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>医生</span>
                <Input
                  value={draft.doctor_name}
                  onChange={(e) => setDraft((d) => ({ ...d, doctor_name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>复诊时间</span>
                <Input
                  type="datetime-local"
                  value={draft.follow_up_at}
                  onChange={(e) => setDraft((d) => ({ ...d, follow_up_at: e.target.value }))}
                />
              </label>
            </>
          ) : null}

          {draft.record_kind === "medical_visit" || draft.record_kind === "physical_exam" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>附件（PDF/影像）</span>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              {pendingFiles.length > 0 ? (
                <ul className="text-muted-foreground text-xs">
                  {pendingFiles.map((f) => (
                    <li key={`${f.name}-${f.size}`}>{f.name}</li>
                  ))}
                </ul>
              ) : null}
              {selected?.file_entity_ids.length ? (
                <ul className="text-xs">
                  {selected.file_entity_ids.map((fid) => (
                    <li key={fid}>
                      <a className="text-primary underline" href={`/entity?id=${fid}`}>
                        附件 #{fid}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
          ) : null}

          {selected?.exam_items.length ? (
            <div className="text-sm">
              <span className="font-medium">已存检验项</span>
              <ul className="mt-1 space-y-1">
                {selected.exam_items.map((item) => (
                  <li key={`${item.metric_key}-${item.name}`} className={examFlagClass(item.flag)}>
                    {item.name}: {item.value}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.flag && item.flag !== "unknown" ? ` (${item.flag})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" isDisabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "保存"}
            </Button>
            {selectedId != null ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                isDisabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 className="size-4" />
                删除
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
