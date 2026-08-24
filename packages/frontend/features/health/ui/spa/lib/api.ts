import {
  healthAttachFilesOutputSchema,
  healthFileUploadOutputSchema,
  type HealthRowPayload,
  type HealthRecordKind,
} from "@freeanima/shared/rpc-contract/frames/health.ts";
import { parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";
import { omitUndefined } from "@freeanima/shared/util";

export type HealthRow = HealthRowPayload;
export type { HealthRecordKind };

export type HealthCreatePayload = {
  record_kind: HealthRecordKind;
  recorded_at: string;
  title: string;
  content?: string;
  profile_key?: string;
  readings?: HealthRow["readings"];
  exam_items?: HealthRow["exam_items"];
  medication_source?: HealthRow["medication_source"];
  dosage?: string;
  frequency?: string;
  start_at?: string;
  end_at?: string;
  related_task_id?: number | null;
  visit_type?: HealthRow["visit_type"];
  facility?: string;
  doctor_name?: string;
  follow_up_at?: string;
  file_entity_ids?: number[];
};

export type HealthPatchPayload = Partial<HealthCreatePayload>;

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchHealthRecords(
  subjectId: number,
  opts?: { record_kind?: HealthRecordKind; profile_key?: string; limit?: number },
): Promise<HealthRow[]> {
  const scope = resolveHabitatCacheScope();
  const kindKey = opts?.record_kind ?? "all";
  const cacheId = `list:${subjectId}:${kindKey}`;

  return withOfflineCache({
    scope,
    namespace: "health",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call(
        "health.list",
        omitUndefined({
          subject_id: subjectId,
          record_kind: opts?.record_kind,
          profile_key: opts?.profile_key,
          limit: opts?.limit ?? 500,
        }),
      );
      return data.items;
    },
    offlineError: "health.list unavailable offline",
  });
}

export async function getHealthRecordRemote(subjectId: number, id: number): Promise<HealthRow> {
  const data = await habitat().call("health.get", { subject_id: subjectId, id });
  return data.item;
}

export async function createHealthRecordRemote(
  subjectId: number,
  input: HealthCreatePayload,
): Promise<HealthRow> {
  const data = await habitat().call("health.create", {
    subject_id: subjectId,
    record_kind: input.record_kind,
    recorded_at: input.recorded_at,
    title: input.title,
    ...omitUndefined({
      content: input.content,
      profile_key: input.profile_key,
      readings: input.readings,
      exam_items: input.exam_items,
      medication_source: input.medication_source,
      dosage: input.dosage,
      frequency: input.frequency,
      start_at: input.start_at,
      end_at: input.end_at,
      related_task_id: input.related_task_id,
      visit_type: input.visit_type,
      facility: input.facility,
      doctor_name: input.doctor_name,
      follow_up_at: input.follow_up_at,
      file_entity_ids: input.file_entity_ids,
    }),
  });
  await invalidatePortalReads(["health"]);
  return data.item;
}

export async function patchHealthRecordRemote(
  subjectId: number,
  id: number,
  patch: HealthPatchPayload,
): Promise<HealthRow> {
  const data = await habitat().call(
    "health.patch",
    omitUndefined({ subject_id: subjectId, id, ...patch }),
  );
  await invalidatePortalReads(["health"]);
  return data.item;
}

export async function deleteHealthRecordRemote(subjectId: number, id: number): Promise<void> {
  await habitat().call("health.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["health"]);
}

export async function fetchHealthMetricSeries(
  subjectId: number,
  metricKey: string,
  opts?: { profile_key?: string; limit?: number },
): Promise<Array<{ recorded_at: string; value: number; record_id: number }>> {
  const data = await habitat().call(
    "health.metrics.series",
    omitUndefined({
      subject_id: subjectId,
      metric_key: metricKey,
      profile_key: opts?.profile_key,
      limit: opts?.limit ?? 50,
    }),
  );
  return data.points;
}

export async function attachHealthFilesRemote(
  subjectId: number,
  recordId: number,
  files: File[],
): Promise<HealthRow> {
  const form = new FormData();
  for (const file of files) {
    form.append("file", file, file.name);
  }
  const res = await habitat().callRaw(
    "health.attachFiles",
    { subject_id: subjectId, id: recordId },
    { body: form },
  );
  const raw = await parseHabitatRestResponse(res);
  const body = healthAttachFilesOutputSchema.parse(raw);
  await invalidatePortalReads(["health"]);
  return body.item;
}

export async function uploadHealthFileRemote(
  subjectId: number,
  file: File,
): Promise<{ object_file_id: number; filename: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await habitat().callRaw(
    "health.file.upload",
    { subject_id: subjectId },
    {
      body: form,
    },
  );
  const raw = await parseHabitatRestResponse(res);
  return healthFileUploadOutputSchema.parse(raw);
}
