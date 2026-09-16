import type { ComponentType } from "react";

import { lazyNamedComponent } from "../lazy-route.tsx";

/** Lazily loads the SPA component for a feature shell route. */
export type FeatureRouteLoader = () => Promise<{ default: ComponentType<object> }>;

/**
 * Feature id → SPA loader. The shell route metadata (path / navLabel) lives in
 * `@freeanima/shared/feature-catalog`; this map only owns the React boundary
 * (component name, CSS side effects) that cannot be shared with the server.
 */
export const FEATURE_ROUTE_LOADERS: Readonly<Record<string, FeatureRouteLoader>> = {
  chat: () =>
    import("@freeanima/features/chat/ui/spa").then(async (mod) => {
      await import("@freeanima/features/chat/ui/spa/styles.css");
      return { default: mod.ChatApp };
    }),
  task: lazyNamedComponent(() => import("@freeanima/features/task/ui/spa"), "TaskApp"),
  project: lazyNamedComponent(() => import("@freeanima/features/project/ui/spa"), "ProjectApp"),
  objective: lazyNamedComponent(
    () => import("@freeanima/features/objective/ui/spa"),
    "ObjectiveApp",
  ),
  habit: lazyNamedComponent(() => import("@freeanima/features/habit/ui/spa"), "HabitApp"),
  calendar: lazyNamedComponent(() => import("@freeanima/features/calendar/ui/spa"), "CalendarApp"),
  pomodoro: lazyNamedComponent(() => import("@freeanima/features/pomodoro/ui/spa"), "PomodoroApp"),
  vault: lazyNamedComponent(() => import("@freeanima/features/vault/ui/spa"), "VaultApp"),
  entity: lazyNamedComponent(() => import("@freeanima/features/entity/ui/spa"), "EntityApp"),
  notification: lazyNamedComponent(
    () => import("@freeanima/features/notification/ui/spa"),
    "NotificationApp",
  ),
  diary: lazyNamedComponent(() => import("@freeanima/features/diary/ui/spa"), "DiaryApp"),
  note: lazyNamedComponent(() => import("@freeanima/features/note/ui/spa"), "NoteApp"),
  bookmark: lazyNamedComponent(() => import("@freeanima/features/bookmark/ui/spa"), "BookmarkApp"),
  health: lazyNamedComponent(() => import("@freeanima/features/health/ui/spa"), "HealthApp"),
  contact: lazyNamedComponent(() => import("@freeanima/features/contact/ui/spa"), "ContactApp"),
  room: () =>
    import("@freeanima/features/room/ui/spa").then(async (mod) => {
      await import("@freeanima/features/chat/ui/spa/styles.css");
      return { default: mod.RoomApp };
    }),
  email: lazyNamedComponent(() => import("@freeanima/features/email/ui/spa"), "EmailApp"),
};
