import { omitUndefined } from "@freeanima/core/util";
import {
  pomodoroConfigGetInputSchema,
  pomodoroConfigUpdateInputSchema,
  pomodoroFocusListInputSchema,
  pomodoroSessionAbortInputSchema,
  pomodoroSessionCompleteInputSchema,
  pomodoroSessionListInputSchema,
  pomodoroSessionStatsInputSchema,
  pomodoroActiveGetInputSchema,
  pomodoroActivePutInputSchema,
  pomodoroActiveClearInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as service from "./service.ts";

export type PomodoroSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handlePomodoroConfigGet(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroConfigGetInputSchema.parse(payload);
  return service.servicePomodoroConfigGet(deps.runtime.runtimeDeps(), input);
}

export async function handlePomodoroConfigUpdate(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroConfigUpdateInputSchema.parse(payload);
  return service.servicePomodoroConfigUpdate(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroSessionComplete(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroSessionCompleteInputSchema.parse(payload);
  return service.servicePomodoroSessionComplete(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroSessionAbort(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroSessionAbortInputSchema.parse(payload);
  return service.servicePomodoroSessionAbort(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroSessionList(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroSessionListInputSchema.parse(payload);
  return service.servicePomodoroSessionList(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroSessionStats(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroSessionStatsInputSchema.parse(payload);
  return service.servicePomodoroSessionStats(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroFocusList(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroFocusListInputSchema.parse(payload);
  return service.servicePomodoroFocusList(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handlePomodoroActiveGet(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroActiveGetInputSchema.parse(payload);
  return service.servicePomodoroActiveGet(deps.runtime.runtimeDeps(), input);
}

export async function handlePomodoroActivePut(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroActivePutInputSchema.parse(payload);
  return service.servicePomodoroActivePut(deps.runtime.runtimeDeps(), input);
}

export async function handlePomodoroActiveClear(
  deps: PomodoroSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = pomodoroActiveClearInputSchema.parse(payload);
  return service.servicePomodoroActiveClear(deps.runtime.runtimeDeps(), input);
}
