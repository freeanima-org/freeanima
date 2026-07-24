import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import type {
  CompanionClientConfigPayload,
  CompanionConfigUpdateInput,
  CompanionMigrateFromLocalInput,
  CompanionModelDeleteInput,
  CompanionModelRenameInput,
  CompanionModelSetActiveInput,
  CompanionMotionDeleteInput,
  CompanionMotionRenameInput,
  CompanionMotionSetSlotInput,
} from "../protocol/index.ts";
import { buildClientCompanionConfig, listAssetDownloadUrls } from "../domain/client-config.ts";
import { habitatUrlFromEnv, loadCompanionConfig, saveCompanionConfig } from "../domain/config.ts";
import { migrateFromLocalDir } from "../domain/migrate.ts";
import { deleteModel, renameModel, setActiveModel } from "../domain/model-registry.ts";
import { importMotionUpload } from "../domain/motion-import.ts";
import { deleteMotion, renameMotion, setSlotMotions } from "../domain/motion-library.ts";
import { mergeBehavior } from "../domain/behavior.ts";

function assertPg(): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

export async function serviceCompanionConfigGet(): Promise<{
  config: CompanionClientConfigPayload;
}> {
  assertPg();
  const config = await buildClientCompanionConfig();
  return { config };
}

export async function serviceCompanionConfigUpdate(
  input: CompanionConfigUpdateInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  const current = await loadCompanionConfig();
  await saveCompanionConfig({
    ...(input.active_model_id !== undefined ? { active_model_id: input.active_model_id } : {}),
    ...(input.motion_slots !== undefined
      ? {
          motion_slots: {
            idle: input.motion_slots.idle ?? current.motion_slots.idle,
            rest: input.motion_slots.rest ?? current.motion_slots.rest,
            walk: input.motion_slots.walk ?? current.motion_slots.walk,
            climb: input.motion_slots.climb ?? current.motion_slots.climb,
            in_place: input.motion_slots.in_place ?? current.motion_slots.in_place,
          },
        }
      : {}),
    ...(input.behavior !== undefined
      ? {
          behavior: mergeBehavior(
            Object.fromEntries(
              Object.entries(input.behavior).filter(([, v]) => v !== undefined),
            ) as Partial<typeof current.behavior>,
          ),
        }
      : {}),
  });
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionModelSetActive(
  input: CompanionModelSetActiveInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await setActiveModel(input.id);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionModelRename(
  input: CompanionModelRenameInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await renameModel(input.id, input.name);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionModelDelete(
  input: CompanionModelDeleteInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await deleteModel(input.id);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionMotionSetSlot(
  input: CompanionMotionSetSlotInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await setSlotMotions(input.slot, input.motion_ids);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionMotionRename(
  input: CompanionMotionRenameInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await renameMotion(input.id, input.name);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionMotionDelete(
  input: CompanionMotionDeleteInput,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await deleteMotion(input.id);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionMigrateFromLocal(
  input: CompanionMigrateFromLocalInput,
): Promise<{
  config: CompanionClientConfigPayload;
  imported_models: number;
  imported_motions: number;
}> {
  assertPg();
  const result = await migrateFromLocalDir(input.source_dir);
  return {
    config: await buildClientCompanionConfig(),
    imported_models: result.imported_models,
    imported_motions: result.imported_motions,
  };
}

export async function serviceCompanionSyncPull(): Promise<{
  config: CompanionClientConfigPayload;
  asset_urls: string[];
}> {
  assertPg();
  const cfg = await loadCompanionConfig();
  const habitatBase = habitatUrlFromEnv();
  return {
    config: await buildClientCompanionConfig(),
    asset_urls: listAssetDownloadUrls(habitatBase, cfg),
  };
}

export async function serviceCompanionModelUpload(
  file: File,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  const { addModelFromUpload } = await import("../domain/model-registry.ts");
  await addModelFromUpload(file);
  return { config: await buildClientCompanionConfig() };
}

export async function serviceCompanionMotionImport(
  uploadName: string,
  bytes: Uint8Array,
): Promise<{ config: CompanionClientConfigPayload }> {
  assertPg();
  await importMotionUpload(uploadName, bytes);
  return { config: await buildClientCompanionConfig() };
}

export function serviceCompanionConfigUpdateOmit(
  input: CompanionConfigUpdateInput,
): CompanionConfigUpdateInput {
  return omitUndefined(input);
}
