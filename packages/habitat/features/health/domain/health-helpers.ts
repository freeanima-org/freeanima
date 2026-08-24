import { getHealthMetricDef } from "@freeanima/shared/health/metric-catalog.ts";
import type {
  HealthExamItem,
  HealthRecordBody,
} from "@freeanima/habitat/core/db/schema/entity/components/health-record.ts";

export function flagExamItem(item: HealthExamItem): HealthExamItem {
  const num =
    typeof item.value === "number" ? item.value : Number.parseFloat(item.value.replace(/,/g, ""));
  if (!Number.isFinite(num)) {
    return { ...item, flag: "unknown" };
  }
  const low = item.ref_low;
  const high = item.ref_high;
  if (low != null && num < low) return { ...item, flag: "low" };
  if (high != null && num > high) return { ...item, flag: "high" };
  if (low != null || high != null) return { ...item, flag: "normal" };
  return { ...item, flag: item.flag ?? "unknown" };
}

export function flagExamItems(items: HealthExamItem[] | undefined): HealthExamItem[] {
  if (!items?.length) return [];
  return items.map(flagExamItem);
}

function formatReading(metricKey: string, value: number, unit?: string): string {
  const def = getHealthMetricDef(metricKey);
  const label = def?.label ?? metricKey;
  const u = unit ?? def?.unit ?? "";
  return `${label} ${value}${u ? ` ${u}` : ""}`;
}

export function buildSummary(body: HealthRecordBody, title: string): string {
  const parts: string[] = [];

  if (body.record_kind === "vital_sign" && body.readings?.length) {
    const systolic = body.readings.find((r) => r.metric_key === "blood_pressure_systolic");
    const diastolic = body.readings.find((r) => r.metric_key === "blood_pressure_diastolic");
    if (systolic && diastolic) {
      parts.push(`血压 ${systolic.value}/${diastolic.value} mmHg`);
    }
    for (const r of body.readings) {
      if (
        r.metric_key === "blood_pressure_systolic" ||
        r.metric_key === "blood_pressure_diastolic"
      ) {
        continue;
      }
      parts.push(formatReading(r.metric_key, r.value, r.unit));
    }
  }

  if (body.record_kind === "physical_exam" && body.exam_items?.length) {
    const flagged = body.exam_items.filter((i) => i.flag === "high" || i.flag === "low");
    if (flagged.length > 0) {
      parts.push(`${flagged.length} 项异常`);
    } else {
      parts.push(`${body.exam_items.length} 项指标`);
    }
  }

  if (body.record_kind === "medication") {
    if (body.dosage) parts.push(body.dosage);
    if (body.frequency) parts.push(body.frequency);
  }

  if (body.record_kind === "medical_visit") {
    if (body.visit_type) parts.push(body.visit_type);
    if (body.facility) parts.push(body.facility);
  }

  const joined = parts.join(" · ").trim();
  if (joined) return joined;
  return title.trim() || body.record_kind;
}

export type MetricSeriesPoint = {
  recorded_at: string;
  value: number;
  record_id: number;
};

export function extractMetricValue(body: HealthRecordBody, metricKey: string): number | null {
  if (body.record_kind === "vital_sign" && body.readings) {
    const hit = body.readings.find((r) => r.metric_key === metricKey);
    return hit ? hit.value : null;
  }
  if (body.record_kind === "physical_exam" && body.exam_items) {
    const hit = body.exam_items.find((i) => i.metric_key === metricKey);
    if (!hit) return null;
    const num =
      typeof hit.value === "number" ? hit.value : Number.parseFloat(hit.value.replace(/,/g, ""));
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function collectMetricSeries(
  rows: Array<{
    id: number;
    body: HealthRecordBody;
  }>,
  metricKey: string,
  opts?: { since?: string; until?: string; limit?: number },
): MetricSeriesPoint[] {
  const since = opts?.since;
  const until = opts?.until;
  const limit = opts?.limit ?? 100;

  const points: MetricSeriesPoint[] = [];
  for (const row of rows) {
    const recordedAt = row.body.recorded_at;
    if (since && recordedAt < since) continue;
    if (until && recordedAt > until) continue;
    const value = extractMetricValue(row.body, metricKey);
    if (value == null) continue;
    points.push({ recorded_at: recordedAt, value, record_id: row.id });
  }

  return points
    .toSorted((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.record_id - a.record_id)
    .slice(0, limit);
}
