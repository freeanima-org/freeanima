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

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/hub-contract";

export const pomodoroMethodDefs = {
  "pomodoro.config.get": defineHubMethod({
    input: pomodoroConfigGetInputSchema,
    output: pomodoroConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.config.update": defineHubMethod({
    input: pomodoroConfigUpdateInputSchema,
    output: pomodoroConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.complete": defineHubMethod({
    input: pomodoroSessionCompleteInputSchema,
    output: pomodoroSessionCompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.abort": defineHubMethod({
    input: pomodoroSessionAbortInputSchema,
    output: pomodoroSessionAbortOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.list": defineHubMethod({
    input: pomodoroSessionListInputSchema,
    output: pomodoroSessionListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.session.stats": defineHubMethod({
    input: pomodoroSessionStatsInputSchema,
    output: pomodoroSessionStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.focus.list": defineHubMethod({
    input: pomodoroFocusListInputSchema,
    output: pomodoroFocusListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.get": defineHubMethod({
    input: pomodoroActiveGetInputSchema,
    output: pomodoroActiveGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.put": defineHubMethod({
    input: pomodoroActivePutInputSchema,
    output: pomodoroActivePutOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.active.clear": defineHubMethod({
    input: pomodoroActiveClearInputSchema,
    output: pomodoroActiveClearOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
