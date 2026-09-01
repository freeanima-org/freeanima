import { z } from "zod";

export const healthRecordKindSchema = z.enum([
  "vital_sign",
  "medical_visit",
  "medication",
  "physical_exam",
]);

export type HealthRecordKind = z.infer<typeof healthRecordKindSchema>;

export const healthExamFlagSchema = z.enum(["normal", "high", "low", "unknown"]);

export const healthReadingSchema = z.object({
  metric_key: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
});

export const healthExamItemSchema = z.object({
  metric_key: z.string().min(1),
  name: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  ref_low: z.number().nullable().optional(),
  ref_high: z.number().nullable().optional(),
  flag: healthExamFlagSchema.optional(),
});

export const healthMedicationSourceSchema = z.enum(["prescription", "self_purchase"]);

export const healthVisitTypeSchema = z.enum(["blood", "chest_xray", "ct", "diagnosis", "other"]);

export const healthRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  record_kind: healthRecordKindSchema,
  recorded_at: z.string(),
  profile_key: z.string(),
  readings: z.array(healthReadingSchema),
  exam_items: z.array(healthExamItemSchema),
  medication_source: healthMedicationSourceSchema.nullable(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  related_task_id: z.number().int().positive().nullable(),
  visit_type: healthVisitTypeSchema.nullable(),
  facility: z.string().nullable(),
  doctor_name: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  file_entity_ids: z.array(z.number().int().positive()),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type HealthRowPayload = z.infer<typeof healthRowSchema>;

export const healthListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  record_kind: healthRecordKindSchema.optional(),
  profile_key: z.string().min(1).optional(),
  limit: z.number().int().positive().max(2000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type HealthListInput = z.infer<typeof healthListInputSchema>;
export const healthListOutputSchema = z.object({ items: z.array(healthRowSchema) });
export type HealthListOutput = z.infer<typeof healthListOutputSchema>;

export const healthGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type HealthGetInput = z.infer<typeof healthGetInputSchema>;
export const healthGetOutputSchema = z.object({ item: healthRowSchema });
export type HealthGetOutput = z.infer<typeof healthGetOutputSchema>;

export const healthSearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type HealthSearchInput = z.infer<typeof healthSearchInputSchema>;
export const healthSearchOutputSchema = z.object({
  items: z.array(healthRowSchema),
  count: z.number().int().nonnegative(),
});
export type HealthSearchOutput = z.infer<typeof healthSearchOutputSchema>;

export const healthCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  record_kind: healthRecordKindSchema,
  recorded_at: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional(),
  profile_key: z.string().min(1).optional(),
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
  file_entity_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type HealthCreateInputPayload = z.infer<typeof healthCreateInputSchema>;
export const healthCreateOutputSchema = z.object({ item: healthRowSchema });
export type HealthCreateOutput = z.infer<typeof healthCreateOutputSchema>;

export const healthPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  record_kind: healthRecordKindSchema.optional(),
  recorded_at: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  profile_key: z.string().min(1).optional(),
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
  file_entity_ids: z.array(z.number().int().positive()).optional(),
});
export type HealthPatchInput = z.infer<typeof healthPatchInputSchema>;
export const healthPatchOutputSchema = z.object({ item: healthRowSchema });
export type HealthPatchOutput = z.infer<typeof healthPatchOutputSchema>;

export const healthDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type HealthDeleteInput = z.infer<typeof healthDeleteInputSchema>;
export const healthDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type HealthDeleteOutput = z.infer<typeof healthDeleteOutputSchema>;

export const healthMetricsSeriesInputSchema = z.object({
  subject_id: z.number().int().positive(),
  metric_key: z.string().min(1),
  profile_key: z.string().min(1).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});
export type HealthMetricsSeriesInput = z.infer<typeof healthMetricsSeriesInputSchema>;

export const healthMetricSeriesPointSchema = z.object({
  recorded_at: z.string(),
  value: z.number(),
  record_id: z.number().int().positive(),
});

export const healthMetricsSeriesOutputSchema = z.object({
  points: z.array(healthMetricSeriesPointSchema),
});
export type HealthMetricsSeriesOutput = z.infer<typeof healthMetricsSeriesOutputSchema>;

export const healthAttachFilesInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type HealthAttachFilesInput = z.infer<typeof healthAttachFilesInputSchema>;

export const healthAttachFilesOutputSchema = z.object({ item: healthRowSchema });
export type HealthAttachFilesOutput = z.infer<typeof healthAttachFilesOutputSchema>;

export const healthFileUploadOutputSchema = z.object({
  object_file_id: z.number().int().positive(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number().int().nonnegative(),
});
export type HealthFileUploadOutput = z.infer<typeof healthFileUploadOutputSchema>;
