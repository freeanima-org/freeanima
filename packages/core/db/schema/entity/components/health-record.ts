import { HEALTH_RECORD_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { HEALTH_RECORD_COMPONENT };

import { z } from "zod";

export const healthRecordKindSchema = z.enum([
  "vital_sign",
  "medical_visit",
  "medication",
  "physical_exam",
]);

export type HealthRecordKind = z.infer<typeof healthRecordKindSchema>;

export const healthExamFlagSchema = z.enum(["normal", "high", "low", "unknown"]);

export type HealthExamFlag = z.infer<typeof healthExamFlagSchema>;

export const healthReadingSchema = z.object({
  metric_key: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
});

export type HealthReading = z.infer<typeof healthReadingSchema>;

export const healthExamItemSchema = z.object({
  metric_key: z.string().min(1),
  name: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  ref_low: z.number().nullable().optional(),
  ref_high: z.number().nullable().optional(),
  flag: healthExamFlagSchema.optional(),
});

export type HealthExamItem = z.infer<typeof healthExamItemSchema>;

export const healthMedicationSourceSchema = z.enum(["prescription", "self_purchase"]);

export const healthVisitTypeSchema = z.enum(["blood", "chest_xray", "ct", "diagnosis", "other"]);

export const healthRecordBodySchema = z.object({
  record_kind: healthRecordKindSchema,
  recorded_at: z.string().min(1),
  profile_key: z.string().min(1).default("self"),
  readings: z.array(healthReadingSchema).optional(),
  exam_items: z.array(healthExamItemSchema).optional(),
  medication_source: healthMedicationSourceSchema.optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  related_task_id: z.number().int().positive().nullable().optional(),
  visit_type: healthVisitTypeSchema.optional(),
  facility: z.string().optional(),
  doctor_name: z.string().optional(),
  follow_up_at: z.string().optional(),
  file_entity_ids: z.array(z.number().int().positive()).default([]),
});

export type HealthRecordBody = z.infer<typeof healthRecordBodySchema>;
