import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  habitArchiveInputSchema,
  habitArchiveOutputSchema,
  habitCheckInInputSchema,
  habitCheckInOutputSchema,
  habitCreateInputSchema,
  habitCreateOutputSchema,
  habitDeleteInputSchema,
  habitDeleteOutputSchema,
  habitGetInputSchema,
  habitGetOutputSchema,
  habitListCheckInsInputSchema,
  habitListCheckInsOutputSchema,
  habitListInputSchema,
  habitListOutputSchema,
  habitPatchInputSchema,
  habitPatchOutputSchema,
  habitPresetsInputSchema,
  habitPresetsOutputSchema,
  habitReorderInputSchema,
  habitReorderOutputSchema,
  habitStatsInputSchema,
  habitStatsOutputSchema,
  habitUnarchiveInputSchema,
  habitUnarchiveOutputSchema,
  habitUndoCheckInInputSchema,
  habitUndoCheckInOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/habit";

export const habitMethodDefs = {
  "habit.list": defineHabitatMethod({
    input: habitListInputSchema,
    output: habitListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "habit.get": defineHabitatMethod({
    input: habitGetInputSchema,
    output: habitGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "habit.create": defineHabitatMethod({
    input: habitCreateInputSchema,
    output: habitCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.patch": defineHabitatMethod({
    input: habitPatchInputSchema,
    output: habitPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.delete": defineHabitatMethod({
    input: habitDeleteInputSchema,
    output: habitDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.reorder": defineHabitatMethod({
    input: habitReorderInputSchema,
    output: habitReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.archive": defineHabitatMethod({
    input: habitArchiveInputSchema,
    output: habitArchiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.unarchive": defineHabitatMethod({
    input: habitUnarchiveInputSchema,
    output: habitUnarchiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.checkIn": defineHabitatMethod({
    input: habitCheckInInputSchema,
    output: habitCheckInOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.undoCheckIn": defineHabitatMethod({
    input: habitUndoCheckInInputSchema,
    output: habitUndoCheckInOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "habit.listCheckIns": defineHabitatMethod({
    input: habitListCheckInsInputSchema,
    output: habitListCheckInsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "habit.stats": defineHabitatMethod({
    input: habitStatsInputSchema,
    output: habitStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "habit.presets": defineHabitatMethod({
    input: habitPresetsInputSchema,
    output: habitPresetsOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
