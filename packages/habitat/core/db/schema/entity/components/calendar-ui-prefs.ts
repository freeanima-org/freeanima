import { CALENDAR_UI_PREFS_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { CALENDAR_UI_PREFS_COMPONENT };

import { z } from "zod";

export const calendarViewModeSchema = z.enum(["day", "next3", "next7", "week", "month"]);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;

export const calendarKindPrefSchema = z.enum(["event", "task", "project", "habit"]);
export type CalendarKindPref = z.infer<typeof calendarKindPrefSchema>;

export const calendarBuiltinSourceSchema = z.enum([
  "cn_holiday",
  "traditional",
  "international",
  "solar_term",
]);

export const calendarViewDisplayPrefsSchema = z.object({
  kinds: z.array(calendarKindPrefSchema).min(0),
  builtinSources: z.array(calendarBuiltinSourceSchema),
  expandRecurrence: z.boolean(),
  showCompleted: z.boolean(),
  showEndedEvents: z.boolean(),
});

export type CalendarViewDisplayPrefs = z.infer<typeof calendarViewDisplayPrefsSchema>;

const ALL_KINDS: CalendarKindPref[] = ["event", "task", "project", "habit"];
const ALL_SOURCES = ["cn_holiday", "traditional", "international", "solar_term"] as const;

function defaultViewDisplay(mode: CalendarViewMode): CalendarViewDisplayPrefs {
  const agendaLike = mode === "day" || mode === "next3" || mode === "next7";
  return {
    kinds: [...ALL_KINDS],
    builtinSources: [...ALL_SOURCES],
    expandRecurrence: true,
    showCompleted: mode !== "month",
    showEndedEvents: !agendaLike,
  };
}

export const DEFAULT_CALENDAR_UI_PREFS = {
  viewMode: "month" as CalendarViewMode,
  byView: {
    day: defaultViewDisplay("day"),
    next3: defaultViewDisplay("next3"),
    next7: defaultViewDisplay("next7"),
    week: defaultViewDisplay("week"),
    month: defaultViewDisplay("month"),
  },
};

export const calendarUiPrefsBodySchema = z.object({
  viewMode: calendarViewModeSchema.default("month"),
  byView: z
    .object({
      day: calendarViewDisplayPrefsSchema,
      next3: calendarViewDisplayPrefsSchema,
      next7: calendarViewDisplayPrefsSchema,
      week: calendarViewDisplayPrefsSchema,
      month: calendarViewDisplayPrefsSchema,
    })
    .default(DEFAULT_CALENDAR_UI_PREFS.byView),
});

export type CalendarUiPrefsBody = z.infer<typeof calendarUiPrefsBodySchema>;
