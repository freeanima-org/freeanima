import { z } from "zod";

import {
  healthExamItemSchema,
  healthMedicationSourceSchema,
  healthReadingSchema,
  healthRecordKindSchema,
  healthVisitTypeSchema,
} from "@freeanima/shared/rpc-contract/frames/health.ts";

export type { HealthRowPayload as HealthRow } from "@freeanima/shared/rpc-contract/frames/health.ts";

export type HealthRecordKind = z.infer<typeof healthRecordKindSchema>;

export type HealthCreateInput = {
  record_kind: HealthRecordKind;
  recorded_at: string;
  title: string;
  content?: string;
  profile_key?: string;
  readings?: z.infer<typeof healthReadingSchema>[];
  exam_items?: z.infer<typeof healthExamItemSchema>[];
  medication_source?: z.infer<typeof healthMedicationSourceSchema>;
  dosage?: string;
  frequency?: string;
  start_at?: string;
  end_at?: string;
  related_task_id?: number | null;
  visit_type?: z.infer<typeof healthVisitTypeSchema>;
  facility?: string;
  doctor_name?: string;
  follow_up_at?: string;
  file_entity_ids?: number[];
  client_op_id?: string;
};

export type HealthUpdateInput = {
  id: number;
  record_kind?: HealthRecordKind;
  recorded_at?: string;
  title?: string;
  content?: string;
  profile_key?: string;
  readings?: z.infer<typeof healthReadingSchema>[];
  exam_items?: z.infer<typeof healthExamItemSchema>[];
  medication_source?: z.infer<typeof healthMedicationSourceSchema>;
  dosage?: string;
  frequency?: string;
  start_at?: string;
  end_at?: string;
  related_task_id?: number | null;
  visit_type?: z.infer<typeof healthVisitTypeSchema>;
  facility?: string;
  doctor_name?: string;
  follow_up_at?: string;
  file_entity_ids?: number[];
  client_op_id?: string;
};

export type HealthListOpts = {
  record_kind?: HealthRecordKind;
  profile_key?: string;
  limit?: number;
  offset?: number;
};

export type HealthSearchOpts = {
  query: string;
  limit?: number;
  offset?: number;
};

export type HealthMetricsSeriesOpts = {
  metric_key: string;
  profile_key?: string;
  since?: string;
  until?: string;
  limit?: number;
};
