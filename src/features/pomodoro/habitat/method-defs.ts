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
} from "@freeanima/shared/rpc-contract/frames/pomodoro";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const pomodoroMethodDefs = {
  "pomodoro.config.get": defineHabitatMethod({
    input: pomodoroConfigGetInputSchema,
    output: pomodoroConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.config.update": defineHabitatMethod({
    input: pomodoroConfigUpdateInputSchema,
    output: pomodoroConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.complete": defineHabitatMethod({
    input: pomodoroSessionCompleteInputSchema,
    output: pomodoroSessionCompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.abort": defineHabitatMethod({
    input: pomodoroSessionAbortInputSchema,
    output: pomodoroSessionAbortOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.list": defineHabitatMethod({
    input: pomodoroSessionListInputSchema,
    output: pomodoroSessionListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.session.stats": defineHabitatMethod({
    input: pomodoroSessionStatsInputSchema,
    output: pomodoroSessionStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.focus.list": defineHabitatMethod({
    input: pomodoroFocusListInputSchema,
    output: pomodoroFocusListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.get": defineHabitatMethod({
    input: pomodoroActiveGetInputSchema,
    output: pomodoroActiveGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.put": defineHabitatMethod({
    input: pomodoroActivePutInputSchema,
    output: pomodoroActivePutOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.active.clear": defineHabitatMethod({
    input: pomodoroActiveClearInputSchema,
    output: pomodoroActiveClearOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
