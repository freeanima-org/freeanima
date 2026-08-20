import {
  calendarCreateInputSchema,
  calendarCreateOutputSchema,
  calendarDeleteInputSchema,
  calendarDeleteOutputSchema,
  calendarGetInputSchema,
  calendarGetOutputSchema,
  calendarConvertToTaskInputSchema,
  calendarConvertToTaskOutputSchema,
  calendarListInputSchema,
  calendarListOutputSchema,
  calendarPatchInputSchema,
  calendarPatchOutputSchema,
  calendarPrefsGetInputSchema,
  calendarPrefsGetOutputSchema,
  calendarPrefsUpdateInputSchema,
  calendarPrefsUpdateOutputSchema,
  calendarRangeInputSchema,
  calendarRangeOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/calendar";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const calendarMethodDefs = {
  "calendar.list": defineHabitatMethod({
    input: calendarListInputSchema,
    output: calendarListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "calendar.create": defineHabitatMethod({
    input: calendarCreateInputSchema,
    output: calendarCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "calendar.patch": defineHabitatMethod({
    input: calendarPatchInputSchema,
    output: calendarPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "calendar.delete": defineHabitatMethod({
    input: calendarDeleteInputSchema,
    output: calendarDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "calendar.get": defineHabitatMethod({
    input: calendarGetInputSchema,
    output: calendarGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "calendar.convertToTask": defineHabitatMethod({
    input: calendarConvertToTaskInputSchema,
    output: calendarConvertToTaskOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "calendar.range": defineHabitatMethod({
    input: calendarRangeInputSchema,
    output: calendarRangeOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "calendar.prefs.get": defineHabitatMethod({
    input: calendarPrefsGetInputSchema,
    output: calendarPrefsGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "calendar.prefs.update": defineHabitatMethod({
    input: calendarPrefsUpdateInputSchema,
    output: calendarPrefsUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
