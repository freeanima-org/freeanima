import { describe, expect, test } from "bun:test";

import type { HealthRecordBody } from "@freeanima/habitat/core/db/schema/entity/components/health-record.ts";

import {
  buildSummary,
  collectMetricSeries,
  flagExamItem,
  flagExamItems,
} from "./health-helpers.ts";

describe("flagExamItems", () => {
  test("marks high when above ref_high", () => {
    const item = flagExamItem({
      metric_key: "glucose",
      name: "血糖",
      value: 8.5,
      ref_low: 3.9,
      ref_high: 6.1,
    });
    expect(item.flag).toBe("high");
  });

  test("marks low when below ref_low", () => {
    const item = flagExamItem({
      metric_key: "hemoglobin",
      name: "血红蛋白",
      value: 90,
      ref_low: 120,
      ref_high: 160,
    });
    expect(item.flag).toBe("low");
  });

  test("batch flags exam items", () => {
    const items = flagExamItems([
      { metric_key: "a", name: "A", value: 5, ref_low: 1, ref_high: 4 },
      { metric_key: "b", name: "B", value: 2, ref_low: 1, ref_high: 4 },
    ]);
    expect(items[0]?.flag).toBe("high");
    expect(items[1]?.flag).toBe("normal");
  });
});

describe("buildSummary", () => {
  test("formats vital sign readings", () => {
    const body: HealthRecordBody = {
      record_kind: "vital_sign",
      recorded_at: "2026-08-24T00:00:00.000Z",
      profile_key: "self",
      file_entity_ids: [],

      readings: [
        { metric_key: "blood_pressure_systolic", value: 120 },
        { metric_key: "blood_pressure_diastolic", value: 80 },
        { metric_key: "heart_rate", value: 72 },
      ],
    };
    const summary = buildSummary(body, "晨测");
    expect(summary).toContain("血压 120/80");
    expect(summary).toContain("心率");
  });

  test("counts abnormal exam items", () => {
    const body: HealthRecordBody = {
      record_kind: "physical_exam",
      recorded_at: "2026-08-24T00:00:00.000Z",
      profile_key: "self",
      file_entity_ids: [],

      exam_items: [
        { metric_key: "a", name: "A", value: 1, flag: "normal" },
        { metric_key: "b", name: "B", value: 2, flag: "high" },
      ],
    };
    expect(buildSummary(body, "体检")).toBe("1 项异常");
  });
});

describe("collectMetricSeries", () => {
  test("extracts and sorts metric points", () => {
    const rows = [
      {
        id: 1,
        body: {
          record_kind: "vital_sign" as const,
          recorded_at: "2026-08-20T00:00:00.000Z",
          profile_key: "self",
          file_entity_ids: [],

          readings: [{ metric_key: "weight", value: 70 }],
        },
      },
      {
        id: 2,
        body: {
          record_kind: "vital_sign" as const,
          recorded_at: "2026-08-24T00:00:00.000Z",
          profile_key: "self",
          file_entity_ids: [],

          readings: [{ metric_key: "weight", value: 69 }],
        },
      },
    ];
    const points = collectMetricSeries(rows, "weight", { limit: 10 });
    expect(points).toHaveLength(2);
    expect(points[0]?.value).toBe(69);
    expect(points[1]?.value).toBe(70);
  });
});
