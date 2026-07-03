import { omitUndefined } from "@freeanima/core/util";
import {
  diaryListInputSchema,
  diaryCreateInputSchema,
  diaryAppendInputSchema,
  diaryPatchInputSchema,
  diaryDeleteInputSchema,
  diaryGetInputSchema,
  diarySearchInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceEntityDiary from "./service.ts";

/** Minimal SAP server deps for diary handlers (structural superset: platform SapServerDeps). */
export type DiarySapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleDiaryList(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryListInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryList(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handleDiaryCreate(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryCreateInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryCreate(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handleDiaryAppend(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryAppendInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryAppend(deps.runtime.runtimeDeps(), input);
}

export async function handleDiaryPatch(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryPatchInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryPatch(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handleDiaryDelete(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryDeleteInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryDelete(deps.runtime.runtimeDeps(), input);
}

export async function handleDiaryGet(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diaryGetInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiaryGet(deps.runtime.runtimeDeps(), input);
}

export async function handleDiarySearch(
  deps: DiarySapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = diarySearchInputSchema.parse(payload);
  return serviceEntityDiary.serviceDiarySearch(deps.runtime.runtimeDeps(), omitUndefined(input));
}
