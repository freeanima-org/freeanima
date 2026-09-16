/**
 * Feature shell metadata — the single source of truth shared by the backend
 * feature plugins and the frontend shell router.
 *
 * Keep this module dependency-free (no Node / DB / React imports): it is
 * loaded by the browser bundle as well as by the Habitat server.
 */

export type FeatureShellRoute = {
  readonly featureId: string;
  readonly path: string;
  readonly navLabel?: string;
};

/** Features that appear in the shell navigation, in display order. */
export const FEATURE_SHELL_ROUTES: readonly FeatureShellRoute[] = [
  { featureId: "chat", path: "/chat", navLabel: "Chat" },
  { featureId: "task", path: "/tasks", navLabel: "Tasks" },
  { featureId: "project", path: "/projects", navLabel: "Projects" },
  { featureId: "objective", path: "/objectives", navLabel: "目标" },
  { featureId: "habit", path: "/habits", navLabel: "习惯" },
  { featureId: "calendar", path: "/calendar", navLabel: "Calendar" },
  { featureId: "pomodoro", path: "/pomodoro", navLabel: "Pomodoro" },
  { featureId: "vault", path: "/vault", navLabel: "Vault" },
  { featureId: "entity", path: "/entity", navLabel: "Entity" },
  { featureId: "notification", path: "/notifications", navLabel: "Notifications" },
  { featureId: "diary", path: "/diary", navLabel: "Diary" },
  { featureId: "note", path: "/note", navLabel: "Notes" },
  { featureId: "bookmark", path: "/bookmarks", navLabel: "Bookmarks" },
  { featureId: "health", path: "/health", navLabel: "健康" },
  { featureId: "contact", path: "/contacts", navLabel: "通讯录" },
  { featureId: "room", path: "/rooms", navLabel: "群聊" },
  { featureId: "email", path: "/email", navLabel: "Email" },
  { featureId: "habitat", path: "/habitat", navLabel: "Habitat" },
];

/** Shell route for a feature id, or `undefined` when it has no shell route. */
export const FEATURE_SHELL_ROUTE_BY_ID: ReadonlyMap<string, FeatureShellRoute> = new Map(
  FEATURE_SHELL_ROUTES.map((route) => [route.featureId, route]),
);
