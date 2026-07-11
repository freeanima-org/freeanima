import { omitUndefined } from "@freeanima/core/util";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  pomodoroActiveClearInputSchema,
  pomodoroActiveClearOutputSchema,
  pomodoroActiveGetInputSchema,
  pomodoroActiveGetOutputSchema,
  pomodoroActivePutInputSchema,
  pomodoroActivePutOutputSchema,
  pomodoroConfigGetInputSchema,
  pomodoroConfigGetOutputSchema,
  pomodoroConfigUpdateInputSchema,
  pomodoroConfigUpdateOutputSchema,
  pomodoroFocusListInputSchema,
  pomodoroFocusListOutputSchema,
  pomodoroSessionAbortInputSchema,
  pomodoroSessionAbortOutputSchema,
  pomodoroSessionCompleteInputSchema,
  pomodoroSessionCompleteOutputSchema,
  pomodoroSessionListInputSchema,
  pomodoroSessionListOutputSchema,
  pomodoroSessionStatsInputSchema,
  pomodoroSessionStatsOutputSchema,
} from "@freeanima/shared/sap-contract/frames/pomodoro";

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type PomodoroSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): PomodoroSapServerDeps {
  return deps as PomodoroSapServerDeps;
}

const routes = [
  defineHubRoute({
    method: "pomodoro.config.get",
    input: pomodoroConfigGetInputSchema,
    output: pomodoroConfigGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.servicePomodoroConfigGet(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "pomodoro.config.update",
    input: pomodoroConfigUpdateInputSchema,
    output: pomodoroConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.servicePomodoroConfigUpdate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "pomodoro.session.complete",
    input: pomodoroSessionCompleteInputSchema,
    output: pomodoroSessionCompleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.servicePomodoroSessionComplete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
      ),
  }),
  defineHubRoute({
    method: "pomodoro.session.abort",
    input: pomodoroSessionAbortInputSchema,
    output: pomodoroSessionAbortOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.servicePomodoroSessionAbort(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "pomodoro.session.list",
    input: pomodoroSessionListInputSchema,
    output: pomodoroSessionListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.servicePomodoroSessionList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "pomodoro.session.stats",
    input: pomodoroSessionStatsInputSchema,
    output: pomodoroSessionStatsOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.servicePomodoroSessionStats(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "pomodoro.focus.list",
    input: pomodoroFocusListInputSchema,
    output: pomodoroFocusListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.servicePomodoroFocusList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "pomodoro.active.get",
    input: pomodoroActiveGetInputSchema,
    output: pomodoroActiveGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.servicePomodoroActiveGet(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "pomodoro.active.put",
    input: pomodoroActivePutInputSchema,
    output: pomodoroActivePutOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.servicePomodoroActivePut(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "pomodoro.active.clear",
    input: pomodoroActiveClearInputSchema,
    output: pomodoroActiveClearOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.servicePomodoroActiveClear(depsOf(deps).runtime.runtimeDeps(), input),
  }),
] as const;

export const pomodoroHubRoutes = mergeFeatureRoutes(routes);
