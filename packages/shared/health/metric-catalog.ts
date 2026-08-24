/** 健康指标目录 SSOT — UI 与 health.metrics.series 共用 */

export const HEALTH_RECORD_KINDS = [
  "vital_sign",
  "medical_visit",
  "medication",
  "physical_exam",
] as const;

export type HealthRecordKind = (typeof HEALTH_RECORD_KINDS)[number];

export const HEALTH_RECORD_KIND_LABELS: Record<HealthRecordKind, string> = {
  vital_sign: "体征",
  medical_visit: "就诊",
  medication: "用药",
  physical_exam: "体检",
};

export type HealthMetricDef = {
  key: string;
  label: string;
  unit: string;
  kinds: HealthRecordKind[];
  /** 复合指标子键（如血压收缩/舒张） */
  composite?: readonly string[];
};

export const HEALTH_METRIC_CATALOG: readonly HealthMetricDef[] = [
  { key: "heart_rate", label: "心率", unit: "bpm", kinds: ["vital_sign"] },
  {
    key: "blood_pressure_systolic",
    label: "收缩压",
    unit: "mmHg",
    kinds: ["vital_sign"],
  },
  {
    key: "blood_pressure_diastolic",
    label: "舒张压",
    unit: "mmHg",
    kinds: ["vital_sign"],
  },
  { key: "blood_oxygen", label: "血氧", unit: "%", kinds: ["vital_sign"] },
  { key: "weight", label: "体重", unit: "kg", kinds: ["vital_sign"] },
  { key: "glucose", label: "血糖", unit: "mmol/L", kinds: ["vital_sign", "physical_exam"] },
  { key: "cholesterol", label: "总胆固醇", unit: "mmol/L", kinds: ["physical_exam"] },
  { key: "hemoglobin", label: "血红蛋白", unit: "g/L", kinds: ["physical_exam"] },
];

export function getHealthMetricDef(key: string): HealthMetricDef | undefined {
  return HEALTH_METRIC_CATALOG.find((m) => m.key === key);
}

export function healthMetricsForKind(kind: HealthRecordKind): HealthMetricDef[] {
  return HEALTH_METRIC_CATALOG.filter((m) => m.kinds.includes(kind));
}
